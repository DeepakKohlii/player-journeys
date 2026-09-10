export type EventType =
  | "Position" | "BotPosition" | "Loot" | "BotKill"
  | "BotKilled" | "KilledByStorm" | "Kill" | "Killed";

// [u, v, t, eventTypeIndex]
export type RawEvent = [number, number, number, number];

export interface Journey {
  m: number;          // index into MapPayload.matches
  uid: string;
  bot: 0 | 1;
  dur: number;        // seconds
  path: number[];     // flat u, v, t triples
  ev: RawEvent[];
}

export interface Match {
  id: string;
  date: string;       // YYYY-MM-DD
  start: number;      // unix seconds
  dur: number;
  humans: number;
  bots: number;
  journeys: number[];
}

export interface MapPayload {
  mapId: string;
  label: string;
  image: string;
  eventTypes: EventType[];
  matches: Match[];
  journeys: Journey[];
}

export interface MapIndexEntry {
  mapId: string;
  label: string;
  matches: number;
  journeys: number;
}

export interface DataIndex {
  maps: MapIndexEntry[];
  eventTypes: EventType[];
}
