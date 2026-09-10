import type { DataIndex, Journey, MapPayload } from "../types";

// UV is 0-1; the canvas works in a fixed square so zoom maths stay integer-friendly.
export const WORLD = 1024;

const cache = new Map<string, Promise<MapPayload>>();

export function loadIndex(): Promise<DataIndex> {
  return fetch(`${import.meta.env.BASE_URL}data/index.json`).then((r) => r.json());
}

export function loadMap(mapId: string): Promise<MapPayload> {
  let p = cache.get(mapId);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/${mapId}.json`).then((r) => r.json());
    cache.set(mapId, p);
  }
  return p;
}

export interface JourneyGeometry {
  journey: Journey;
  coords: [number, number][];
  times: number[];
}

export function toGeometry(j: Journey): JourneyGeometry {
  const coords: [number, number][] = [];
  const times: number[] = [];
  for (let i = 0; i < j.path.length; i += 3) {
    coords.push([j.path[i] * WORLD, j.path[i + 1] * WORLD]);
    times.push(j.path[i + 2]);
  }
  return { journey: j, coords, times };
}
