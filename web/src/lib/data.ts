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

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

// Where the playable area actually sits inside the 1024 square. The minimap art
// is not centred the same way on every map, so fitting the raw square leaves
// dead space (Ambrose Valley only spans u 0.05-0.75).
export function contentBounds(p: MapPayload): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const hit = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const j of p.journeys) {
    for (let i = 0; i < j.path.length; i += 3) hit(j.path[i] * WORLD, j.path[i + 1] * WORLD);
    for (const e of j.ev) hit(e[0] * WORLD, e[1] * WORLD);
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: WORLD, maxY: WORLD };
  const padX = (maxX - minX) * 0.07;
  const padY = (maxY - minY) * 0.07;
  return {
    minX: Math.max(0, minX - padX),
    minY: Math.max(0, minY - padY),
    maxX: Math.min(WORLD, maxX + padX),
    maxY: Math.min(WORLD, maxY + padY),
  };
}
