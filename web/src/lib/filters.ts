import type { EventType, Journey, MapPayload } from "../types";
import { MARKER_EVENTS } from "./colors";

export type Mode = "explore" | "match";

export interface Filters {
  mode: Mode;
  matchId: string | null;
  dates: string[]; // empty means every date
  humans: boolean;
  bots: boolean;
  events: EventType[];
  showPaths: boolean;
  dim: number;       // how far to darken the minimap art, 0-0.9
  pathAlpha: number;
}

export const defaultFilters = (): Filters => ({
  mode: "explore",
  matchId: null,
  dates: [],
  humans: true,
  bots: true,
  events: [...MARKER_EVENTS],
  showPaths: true,
  dim: 0.55,
  pathAlpha: 0.3,
});

export function datesOf(p: MapPayload): string[] {
  return [...new Set(p.matches.map((m) => m.date))].sort();
}

export function filterJourneys(p: MapPayload, f: Filters): Journey[] {
  return p.journeys.filter((j) => {
    if (j.bot ? !f.bots : !f.humans) return false;
    if (f.mode === "match") return p.matches[j.m].id === f.matchId;
    return f.dates.length === 0 || f.dates.includes(p.matches[j.m].date);
  });
}

export interface MatchRow {
  id: string;
  date: string;
  dur: number;
  humans: number;
  bots: number;
  events: number;
  players: number;
}

export function matchRows(p: MapPayload): MatchRow[] {
  return p.matches
    .map((m) => ({
      id: m.id,
      date: m.date,
      dur: m.dur,
      humans: m.humans,
      bots: m.bots,
      players: m.journeys.length,
      events: m.journeys.reduce((n, ji) => n + p.journeys[ji].ev.length, 0),
    }))
    .sort((a, b) => b.players - a.players || b.dur - a.dur);
}

export interface MarkerPoint {
  position: [number, number];
  type: EventType;
  t: number;
  uid: string;
  bot: boolean;
  match: string;
}

export function markersOf(
  p: MapPayload,
  journeys: Journey[],
  f: Filters,
  world: number,
): MarkerPoint[] {
  const keep = new Set(f.events);
  const out: MarkerPoint[] = [];
  for (const j of journeys) {
    for (const e of j.ev) {
      const type = p.eventTypes[e[3]];
      if (!keep.has(type)) continue;
      out.push({
        position: [e[0] * world, e[1] * world],
        type,
        t: e[2],
        uid: j.uid,
        bot: !!j.bot,
        match: p.matches[j.m].id,
      });
    }
  }
  return out;
}

export function countEvents(p: MapPayload, journeys: Journey[]) {
  const counts: Record<string, number> = {};
  for (const j of journeys) {
    for (const e of j.ev) {
      const type = p.eventTypes[e[3]];
      counts[type] = (counts[type] ?? 0) + 1;
    }
  }
  return counts;
}

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
