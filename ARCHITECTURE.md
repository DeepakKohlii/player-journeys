# Architecture

## What it's built with, and why

The whole dataset is **89,104 rows across 1,243 parquet files — 34MB on disk**.
That number decided everything else. Packed into per-map JSON it comes to under
4MB, which fits comfortably in a browser. So there is **no backend, no database
and no API**: a Python script converts the parquet once, offline, and the output
is committed as static files that a React app fetches directly.

That keeps the deployment a static bundle on Vercel, with nothing that can go to
sleep, exceed a free tier, or break while someone is evaluating it.

| Layer | Choice |
|---|---|
| Prep | Python 3, pyarrow, pandas, Pillow — one script, run offline |
| App | React 19 + TypeScript + Vite |
| Rendering | Canvas 2D |
| Hosting | Static on Vercel |

**Rendering started as deck.gl and was replaced.** deck.gl was the obvious pick
for GPU-accelerated map rendering, and it worked — until the WebGL context began
dying on interaction on a machine whose Chrome GPU process was unhealthy, taking
the whole map with it and requiring a reload. Reassessed against the actual data
volume (48k route points, 11k markers — not millions), Canvas 2D handles it
comfortably, cannot lose a GPU context, and behaves identically in every browser.
The bundle also went from 839KB to 199KB. Losing the GPU meant hand-writing
pan/zoom, hit-testing and heatmap binning, which is about 250 lines.

## How data flows

```
data_raw/player_data/February_*/{user}_{match}.nakama-0   1,243 parquet files
        |
        |  pipeline/build.py
        |    - decode the bytes-encoded `event` column
        |    - reinterpret `ts` (see below)
        |    - drop 1,505 exact duplicate rows  -> 87,599
        |    - classify bot vs human from user_id shape
        |    - world (x, z) -> normalised UV via pipeline/maps.py
        |    - rebase every journey onto its own match clock
        |    - group into matches -> journeys -> {path, events}
        v
web/public/data/{Map}.json      AmbroseValley 2.7MB, Lockdown 0.9MB, GrandRift 0.3MB
web/public/maps/{Map}.webp      23MB of source art -> 0.54MB total
        |
        |  fetch on map select, cached in-memory
        v
filters (pure functions over the loaded payload, no refetching)
        |
        v
MapCanvas: basemap -> heatmap -> routes -> event markers -> live positions
```

Filtering, heatmap binning and hit-testing all run client-side over the loaded
payload. Switching filters never touches the network.

## Mapping game coordinates to the minimap

The README shipped with the data gives the transform, and it is correct:

```
u = (x - origin_x) / scale
v = (z - origin_z) / scale
```

with per-map constants — AmbroseValley `scale 900, origin (-370, -473)`,
GrandRift `581, (-290, -290)`, Lockdown `1000, (-500, -500)`.

Three things about applying it mattered.

**The `y` column is elevation, not a map axis.** 2D plotting uses `x` and `z`
only. `y` is deliberately unused.

**The vertical flip lives in exactly one function.** World `z` grows north while
image rows grow south, so `v = 1 - (z - origin_z) / scale`. That flip is baked
into `world_to_uv()` in `pipeline/maps.py` and nowhere else, so nothing
downstream has to remember which way `z` points.

**Everything stays in normalised UV, never pixels.** The supplied README says the
minimaps are 1024×1024 and gives `pixel_x = u * 1024`. They are not. They are
4320×4320, 2160×**2158** and 9000×9000 — and Grand Rift is not square. Hardcoding
1024 would have introduced a small aspect distortion on Grand Rift. The pipeline
emits UV in 0–1 and the app multiplies by a fixed 1024-unit square, so image
dimensions never enter the maths.

**Validation was visual, not arithmetic.** Getting a plausible-looking transform
is easy; getting the right one is confirmed by rendering. All 87,599 points fall
inside 0–1 on all three maps with zero out-of-bounds, routes stop dead at
coastlines, and on Grand Rift loot clusters land exactly on the POIs whose names
are painted into the minimap art — Mine Pit, Gas Station, Cave House. That
last one is the strongest check available, because the labels are in the image
and the coordinates come from the telemetry.

## Assumptions, and the traps in the data

**`ts` is in seconds, not milliseconds.** The parquet schema declares
`timestamp[ms]`, so any naive reader renders these as January 1970. The integers
are unix *seconds*. Three independent checks agree: read as seconds the range is
2026-02-09 to 2026-02-14, matching the folder names exactly; match durations
become 6.4 min median rather than 0.38 s; and position sampling lands on a clean
5-second cadence rather than 200Hz. **The supplied README also says `ts` is
"time elapsed within the match, not wall-clock" — it is absolute wall-clock.**
Match-relative time is derived in the pipeline as `ts − match_start`, which is
what makes the timeline able to overlay hundreds of matches on one clock.

**Event names do not identify actors.** The supplied README says bots emit only
`BotPosition`/`BotKill`/`BotKilled`. In the data bots also emit `Position` (636
rows), `Loot` (115) and `BotKilled` (297). The only reliable discriminator is the
`user_id` shape — numeric is a bot, UUID is a human — and it is clean: 94 bots,
245 humans, zero ambiguous ids.

**1,505 exact duplicate rows** were dropped (identical user, match, position,
timestamp and event), leaving 87,599. Assumed to be telemetry double-writes.

**Matches are effectively solo.** The supplied README describes "10 humans and 40
bots". In reality 90–94% of matches contain a single journey. The UI is built
around that: Explore aggregates across matches by default, and Match mode
surfaces the 53 multi-journey matches with a filter, rather than pretending the
median match is worth replaying.

**"Kill zones" means PvE.** There are 6 player-vs-player events in the entire
dataset against 3,073 player-vs-bot. Kill and death heatmaps are therefore built
from `BotKill` and `BotKilled`, which is stated in the UI labelling.

**Day folders are not date buckets.** `February_10/` contains an event at
2026-02-09 23:58, so dates are derived from timestamps rather than folder names.
This is why a `09 Feb` chip appears for a five-day dataset.

**Grand Rift's minimap is squared** from 2160×2158 during the build. The 2px
difference is 0.09% and the world region is square, so the stretch is negligible.

## Trade-offs

| Decision | Alternative | Why this way |
|---|---|---|
| Precompute to static JSON | Query API over parquet | Under 4MB total. A backend adds a thing that can fail during evaluation and buys nothing |
| Canvas 2D | deck.gl / WebGL | Tried deck.gl first; GPU context loss killed the map on a machine with a broken GPU process. Data volume never needed the GPU |
| Commit `data_raw/` (34MB) | Gitignore it, document a download | The pipeline reproduces from a clean clone, which is the clearest evidence the data flow is real |
| One JSON per map | One combined payload | Only the selected map loads; Ambrose is 2.7MB and rarely needed alongside the others |
| Fit view to content bounds | Fit the 1024 square | The art is not centred identically per map — Ambrose only spans u 0.05–0.75, so fitting the square left a third of the stage empty |
| Heatmaps normalised to p99 | Normalise to max | One loot pile flattened everything else to invisible |
| Dim the basemap, one legend | Per-map route colours | Keeps cyan=human and orange=bot true on every map; the camouflage problem was the busy art, not the line colour |
| Full-detail redraw every frame | Degrade during gestures | Skipping routes mid-drag changed apparent density, which is the signal being read. Full detail is affordable |
