import glob
import json
import os
import re
import sys

import pandas as pd
import pyarrow.parquet as pq
from PIL import Image

from maps import MAPS, world_to_uv

Image.MAX_IMAGE_PIXELS = None

RAW = "data_raw/player_data"
OUT_DATA = "web/public/data"
OUT_MAPS = "web/public/maps"
MAP_MAX_PX = 2048

EVENT_TYPES = ["Position", "BotPosition", "Loot", "BotKill", "BotKilled", "KilledByStorm", "Kill", "Killed"]
POSITION_EVENTS = {"Position", "BotPosition"}
NUMERIC_ID = re.compile(r"\d+")


def load_raw() -> pd.DataFrame:
    frames = []
    for path in sorted(glob.glob(os.path.join(RAW, "February_*", "*"))):
        if os.path.basename(path).startswith("."):
            continue
        df = pq.read_table(path).to_pandas()
        df["event"] = df["event"].str.decode("utf-8")
        frames.append(df)
    if not frames:
        sys.exit(f"no parquet files under {RAW}")

    df = pd.concat(frames, ignore_index=True)

    df["ts"] = df["ts"].values.astype("datetime64[ms]").astype("int64")

    df["is_bot"] = df["user_id"].str.fullmatch(NUMERIC_ID)
    df["match_id"] = df["match_id"].str.replace(".nakama-0", "", regex=False)
    df = df.drop_duplicates(subset=["user_id", "match_id", "x", "y", "z", "ts", "event"])
    return df.sort_values("ts", kind="stable").reset_index(drop=True)


def build_map(df: pd.DataFrame, map_id: str) -> dict:
    cfg = MAPS[map_id]
    sub = df[df["map_id"] == map_id]

    starts = sub.groupby("match_id")["ts"].transform("min")
    sub = sub.assign(t=(sub["ts"] - starts).astype(int))

    u, v = world_to_uv(sub["x"], sub["z"], cfg)
    sub = sub.assign(u=u.round(4), v=v.round(4))

    matches, journeys = [], []
    match_index = {}

    for match_id, mrows in sub.groupby("match_id", sort=False):
        mi = len(matches)
        match_index[match_id] = mi
        first = mrows.iloc[0]
        matches.append({
            "id": match_id,
            "date": pd.to_datetime(first["ts"], unit="s").strftime("%Y-%m-%d"),
            "start": int(first["ts"]),
            "dur": int(mrows["t"].max()),
            "humans": int(mrows.loc[~mrows["is_bot"], "user_id"].nunique()),
            "bots": int(mrows.loc[mrows["is_bot"], "user_id"].nunique()),
            "journeys": [],
        })

        for user_id, jrows in mrows.groupby("user_id", sort=False):
            path, events = [], []
            for row in jrows.itertuples():
                if row.event in POSITION_EVENTS:
                    path.extend((row.u, row.v, row.t))
                else:
                    events.append([row.u, row.v, row.t, EVENT_TYPES.index(row.event)])
            matches[mi]["journeys"].append(len(journeys))
            journeys.append({
                "m": mi,
                "uid": user_id,
                "bot": int(bool(jrows.iloc[0]["is_bot"])),
                "dur": int(jrows["t"].max()),
                "path": path,
                "ev": events,
            })

    return {
        "mapId": map_id,
        "label": cfg.label,
        "image": f"maps/{map_id}.webp",
        "eventTypes": EVENT_TYPES,
        "matches": matches,
        "journeys": journeys,
    }


def build_minimaps():
    os.makedirs(OUT_MAPS, exist_ok=True)
    for map_id, cfg in MAPS.items():
        im = Image.open(os.path.join(RAW, "minimaps", cfg.source_image)).convert("RGB")
        if im.width != im.height:
            side = max(im.size)
            im = im.resize((side, side), Image.LANCZOS)
        if im.width > MAP_MAX_PX:
            im = im.resize((MAP_MAX_PX, MAP_MAX_PX), Image.LANCZOS)
        out = os.path.join(OUT_MAPS, f"{map_id}.webp")
        im.save(out, "WEBP", quality=82, method=6)
        print(f"  {map_id}: {os.path.getsize(out)/1e6:.2f} MB")


def main():
    os.makedirs(OUT_DATA, exist_ok=True)
    print("reading parquet…")
    df = load_raw()
    print(f"  {len(df):,} rows, {df['match_id'].nunique()} matches")

    print("minimaps…")
    build_minimaps()

    print("map payloads…")
    index = []
    for map_id in MAPS:
        payload = build_map(df, map_id)
        out = os.path.join(OUT_DATA, f"{map_id}.json")
        with open(out, "w") as fh:
            json.dump(payload, fh, separators=(",", ":"))
        index.append({
            "mapId": map_id,
            "label": payload["label"],
            "matches": len(payload["matches"]),
            "journeys": len(payload["journeys"]),
        })
        print(f"  {map_id}: {len(payload['matches'])} matches, {os.path.getsize(out)/1e6:.2f} MB")

    with open(os.path.join(OUT_DATA, "index.json"), "w") as fh:
        json.dump({"maps": index, "eventTypes": EVENT_TYPES}, fh, indent=2)


if __name__ == "__main__":
    main()
