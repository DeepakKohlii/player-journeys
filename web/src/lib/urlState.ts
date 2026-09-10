import { MARKER_EVENTS } from "./colors";
import { defaultFilters, type Filters } from "./filters";
import type { EventType } from "../types";
import type { HeatMode } from "./heat";

export interface ViewState { mapId: string; filters: Filters }

const HEATS: HeatMode[] = ["off", "traffic", "cold", "loot", "kills", "deaths"];

export function encode(mapId: string, f: Filters): string {
  const q = new URLSearchParams();
  q.set("map", mapId);
  if (f.mode !== "explore") q.set("mode", f.mode);
  if (f.matchId) q.set("match", f.matchId);
  if (f.dates.length) q.set("dates", f.dates.join(","));
  if (!f.humans) q.set("h", "0");
  if (!f.bots) q.set("b", "0");
  if (f.heat !== "off") q.set("heat", f.heat);
  if (!f.showPaths) q.set("paths", "0");
  if (f.events.length !== MARKER_EVENTS.length) q.set("ev", f.events.join(","));
  if (f.dim !== 0.55) q.set("dim", String(f.dim));
  if (f.pathAlpha !== 0.3) q.set("pa", String(f.pathAlpha));
  return `#console?${q.toString()}`;
}

export function decode(hash: string, fallbackMap: string): ViewState {
  const f = defaultFilters();
  const qi = hash.indexOf("?");
  if (qi < 0) return { mapId: fallbackMap, filters: f };
  const q = new URLSearchParams(hash.slice(qi + 1));

  const mode = q.get("mode");
  if (mode === "match") f.mode = "match";
  f.matchId = q.get("match");

  const dates = q.get("dates");
  if (dates) f.dates = dates.split(",").filter(Boolean);

  if (q.get("h") === "0") f.humans = false;
  if (q.get("b") === "0") f.bots = false;
  if (q.get("paths") === "0") f.showPaths = false;

  const heat = q.get("heat") as HeatMode | null;
  if (heat && HEATS.includes(heat)) f.heat = heat;

  const ev = q.get("ev");
  if (ev !== null) {
    const wanted = ev.split(",").filter(Boolean) as EventType[];
    f.events = MARKER_EVENTS.filter((e) => wanted.includes(e));
  }

  const dim = Number(q.get("dim"));
  if (q.get("dim") !== null && dim >= 0 && dim <= 0.9) f.dim = dim;
  const pa = Number(q.get("pa"));
  if (q.get("pa") !== null && pa > 0 && pa <= 0.8) f.pathAlpha = pa;

  return { mapId: q.get("map") || fallbackMap, filters: f };
}
