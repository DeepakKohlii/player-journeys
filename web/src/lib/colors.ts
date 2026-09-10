import type { EventType } from "../types";

export type RGB = [number, number, number];

export const HUMAN: RGB = [56, 189, 248];
export const BOT: RGB = [251, 146, 60];

// Kills warm, deaths cool, loot green, storm yellow - so a dense cluster still
// reads as "fighting" vs "dying" at a glance.
export const EVENT_COLOR: Record<string, RGB> = {
  Loot: [74, 222, 128],
  BotKill: [239, 68, 68],
  BotKilled: [167, 139, 250],
  KilledByStorm: [250, 204, 21],
  Kill: [255, 122, 0],
  Killed: [236, 72, 153],
};

export const EVENT_LABEL: Record<string, string> = {
  Loot: "Loot",
  BotKill: "Killed a bot",
  BotKilled: "Died to a bot",
  KilledByStorm: "Died to storm",
  Kill: "Killed a player",
  Killed: "Died to a player",
};

// Markers only - Position/BotPosition are drawn as paths.
export const MARKER_EVENTS: EventType[] = [
  "Loot", "BotKill", "BotKilled", "KilledByStorm", "Kill", "Killed",
];

export const css = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
