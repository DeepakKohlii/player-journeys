# BLACKBOX

A player-journey visualisation tool for **LILA BLACK**. It turns five days of raw
match telemetry into a map a Level Designer can open and actually use — routes,
events, heatmaps and match playback, on the correct minimap.

**Live:** https://player-journeys.vercel.app

---

## What it does

| | |
|---|---|
| **Routes** | Every player journey drawn on the minimap. Humans cyan, bots orange. Overlapping routes build up opacity, so busy corridors glow. |
| **Events** | Loot, killed-a-bot, died-to-a-bot, died-to-storm, and the handful of player-vs-player kills, each its own colour. Hover any marker for detail. |
| **Filters** | By map, by date, by match, by human/bot, and by event type. Every count in the panel follows the current filter. |
| **Explore / Match** | Explore aggregates every journey matching your filters. Match drills into one match, with a searchable list that surfaces multiplayer matches first. |
| **Timeline** | Play, scrub and change speed. Every journey is rebased onto its own match clock, so hundreds of matches replay together on one 0–15 min timeline. |
| **Heatmaps** | Traffic, dead space, loot density, kill zones, death zones. |
| **Inspect** | Click any route to isolate that player and see their run — time alive, loot count, how they died. |
| **Shareable views** | Filters live in the URL, so any view can be pasted to a teammate. |

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Data prep | Python 3, pyarrow, pandas, Pillow | Reads the parquet natively; runs once, offline |
| Frontend | React 19 + TypeScript + Vite | Fast to build, fast to deploy |
| Rendering | **Canvas 2D** (no WebGL) | 48k route points and 11k markers are well within Canvas 2D. No GPU dependency, so it renders on any machine |
| Hosting | Static (Vercel) | The whole dataset is under 4MB — no backend, no database, no API |

There are **no environment variables** and no runtime services. The build output
is entirely static files.

---

## Running it locally

Everything runs from the repo root. `build.py` uses paths relative to the
working directory, so it will not find the data if you `cd pipeline` first.

**1. Python environment** (only needed if you want to regenerate the data):

```bash
python3 -m venv .venv && ./.venv/bin/pip install -r pipeline/requirements.txt
```

**2. Regenerate the payloads** — optional, the output is committed:

```bash
./.venv/bin/python pipeline/build.py
```

Reads `data_raw/`, writes `web/public/data/*.json` and `web/public/maps/*.webp`.
Takes about 40 seconds and prints row counts and file sizes as it goes.

**3. Install frontend dependencies:**

```bash
npm --prefix web install
```

**4. Run the dev server:**

```bash
npm --prefix web run dev
```

Opens on `http://localhost:5173`.

**Production build:**

```bash
npm --prefix web run build
```

---

## Repo layout

```
pipeline/          offline parquet -> JSON build
  maps.py            map config and the world -> UV transform
  build.py           the build script
  requirements.txt
web/
  src/
    components/      MapCanvas, TopBar, DataPanel, LayersPanel,
                     MatchList, Timeline, JourneyCard, Hero
    lib/             data loading, filters, colours, heatmaps, URL state
  public/data/       generated per-map payloads (committed)
  public/maps/       downscaled minimaps (committed)
data_raw/          the original parquet dump and full-size minimaps
```

`data_raw/` is committed on purpose so the pipeline reproduces from a clean
clone rather than needing the original zip.

---

## Walkthrough

**1. Landing.** The hero animates 150 real Grand Rift routes drawing themselves
in — the tool's own subject matter. Click **Open console**.

**2. Pick a map.** Ambrose Valley (566 matches), Grand Rift (59), Lockdown (171).
Counts sit next to each name so you know the sample size before you commit.

**3. Explore mode.** All routes for the selected map. Turn bots off in the left
panel to see human routing on its own — that is when the road network becomes
readable.

**4. Narrow it.** Pick a date, or event types on the right. Every count updates.

**5. Heatmaps.** Switch between Traffic, Dead space, Loot density, Kill zones and
Death zones. Turn **Show routes** off for a clean read. Dead space is the one
worth lingering on — it marks walkable ground nobody visits.

**6. Timeline.** Press play. Watch drop clusters fan out along the roads in the
first thirty seconds, aggregated across every match at once.

**7. Match mode.** Tick **More than one player** to find the 53 matches with more
than one journey, then play one back and watch individual players move.

**8. Inspect.** Click any route to isolate that player and read their run.

**9. Share.** Copy the URL — it carries the exact view you are looking at.

---

## Notes

The data has several traps and the ones that matter are written up in
[ARCHITECTURE.md](ARCHITECTURE.md), including the timestamp units, the minimap
dimensions, and how bots are actually identified. Three findings from using the
tool are in [INSIGHTS.md](INSIGHTS.md).
