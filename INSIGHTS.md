# Three things the data showed

All figures come from the deduplicated dataset the tool renders — 87,599 rows,
796 matches, 14,750 non-positional events across the three maps. Every number
below is reproducible from the shipped payloads.

---

## 1. This is a PvE game that is scored like a PvP game

**What caught my eye.** Filtering to humans only on a single day left 197
matches and 197 journeys — exactly one to one. Not a rounding artefact; almost
nobody shares a match with another human.

**The evidence.**

| | Ambrose Valley | Grand Rift | Lockdown |
|---|---|---|---|
| Matches with a single journey | 532 / 566 (94%) | 53 / 59 (90%) | 158 / 171 (92%) |
| Most humans ever in one match | 2 | 1 | 1 |
| Most bots ever in one match | 15 | 12 | 14 |

Across the whole dataset there are **6 player-vs-player events** (3 `Kill`,
3 `Killed`) against **3,073 player-vs-bot events** — a ratio of **1 : 512**.
Bots also never really loot: humans median 10–14 `Loot` events per journey,
bots median **0** on all three maps.

**What's actionable.** Bots are not filler around a PvP core — they *are* the
opposition, and bot density and placement are the entire difficulty curve. Two
concrete items: (a) treat bot encounter pacing as a tuned level-design parameter
per POI rather than a global spawn rate, since 53% of Ambrose human journeys end
at a bot's hands; (b) investigate whether the near-total absence of human
co-presence is a matchmaking or population problem, because every system
designed around player contention is currently inert.

**Metrics affected.** Player-vs-bot encounter rate per POI, session length,
early-session churn, and any engagement metric that assumes contested play.

**Why a Level Designer should care.** Spaces designed to create player-versus-
player confrontation — chokepoints, contested high-value loot, sightlines
between cover — cannot be doing their job when two humans essentially never
occupy the same map. Those same spaces need to be evaluated against bot
encounters instead, which is a different design problem with different sightline
and cover requirements.

---

## 2. The storm is a match timer, not a pressure mechanic

**What caught my eye.** Storm deaths were so rare I had to enlarge their markers
to find them on the map at all.

**The evidence.** 39 storm deaths in 14,750 events — **0.26%**. But the timing is
the real finding: the median storm death lands at **~12 minutes**, and the median
storm death occurs at **fraction 1.00 of its match's duration**. In every case
the storm is the *last* thing that happens. It never kills someone in the middle
of a run and forces the survivors to reposition; it closes out matches that were
already ending.

| | Ambrose Valley | Grand Rift | Lockdown |
|---|---|---|---|
| Storm deaths | 17 | 5 | 17 |
| Share of human journeys ending in storm | 3% | 9% | 10% |
| Median time of storm death | 12.2 min | 11.9 min | 12.7 min |

For contrast, human journeys that ended in death lasted a median of 4.3–5.3
minutes, while those with no death recorded lasted 7.8–8.6 minutes. The storm is
operating well past the point where most runs are already resolved.

**What's actionable.** If the one-directional storm is meant to compress players
into shrinking space and manufacture encounters, it is arriving far too late to
do it. Either bring the storm forward so it starts closing while the median
player is still active (around the 4–6 minute mark), or accept it as a match
timeout and stop designing extraction routes around storm pressure that never
materialises. The three-fold difference between Ambrose (3%) and Lockdown (10%)
also suggests the storm timing is not tuned per map size.

**Metrics affected.** Match duration distribution, extraction success rate,
late-match encounter rate, and the share of matches ending by timeout versus by
player action.

**Why a Level Designer should care.** Storm pressure is what normally justifies
one-way routes, risky shortcuts and extraction point placement. If the storm
never actually squeezes anyone, those layout decisions are being validated
against a force that is not applying, and the map's late game has no author.

---

## 3. A third of every map is walkable ground nobody visits — and the loot is nowhere near it

**What caught my eye.** The Dead space overlay lights up large continuous
regions *inside* the playable area, not just at the edges.

**The evidence.** Binning all position samples into a 48×48 grid and defining
walkable ground as any cell within two cells of recorded traffic:

| | Ambrose Valley | Grand Rift | Lockdown |
|---|---|---|---|
| Walkable cells | 1,227 | 1,080 | 935 |
| Cells with under 10% of median traffic | 350 (**29%**) | 345 (**32%**) | 305 (**33%**) |

Meanwhile loot is extraordinarily concentrated. On Ambrose Valley, **half of all
8,988 loot events sit in just 7% of the cells that contain any loot at all**, and
the **top 20 cells alone hold 40% of all loot**. Grand Rift and Lockdown are the
same story (top 20 cells: 37% and 34%).

Worth noting because it is counterintuitive: loot is *more* spatially
concentrated than combat. Half of all kills spread across 15–23% of active cells
versus loot's 7–20%. Loot spawns at fixed points; fighting happens wherever
players and bots happen to meet, which is more diffuse.

**What's actionable.** The two findings compose into a direct lever: roughly a
third of each map earns no traffic, and loot — the strongest known attractor —
is packed into a handful of cells that are already the busiest. Move a measured
slice of high-value loot from the top 20 cells into the dead regions and
re-measure traffic coverage. If traffic does not follow the loot, the problem is
connectivity rather than incentive, and those regions need routes rather than
rewards. That is a cheap experiment with an unambiguous read.

**Metrics affected.** Percentage of walkable area receiving meaningful traffic,
loot Gini coefficient, average distance travelled per journey, and encounter
rate outside the current hot core.

**Why a Level Designer should care.** A third of the map is being paid for in
art, collision, streaming and build time while returning nothing in play. Either
it should earn traffic, or it should be smaller. This overlay turns "which areas
of the map get ignored" from a hunch into a per-cell measurement you can act on
and then verify against the next five days of telemetry.

---

### Caveats worth stating

Five days, 245 human players and 796 matches is a small sample, and February 14
is a partial day. The Grand Rift figures in particular rest on 59 matches, so
treat its percentages as directional rather than precise. All three findings hold
in the same direction on all three maps independently, which is the main reason I
trust them.
