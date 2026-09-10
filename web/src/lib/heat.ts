import { WORLD, type JourneyGeometry } from "./data";

export type HeatMode = "off" | "traffic" | "loot" | "kills" | "deaths";

export const HEAT_MODES: { id: HeatMode; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "traffic", label: "Traffic" },
  { id: "loot", label: "Loot density" },
  { id: "kills", label: "Kill zones" },
  { id: "deaths", label: "Death zones" },
];

const GRID = 160;
const KILL = new Set(["BotKill", "Kill"]);
const DEATH = new Set(["BotKilled", "Killed", "KilledByStorm"]);

type Stop = [number, number, number];

const RAMPS: Record<Exclude<HeatMode, "off">, [Stop, Stop, Stop]> = {
  traffic: [[10, 34, 74], [56, 189, 248], [226, 248, 255]],
  loot: [[8, 52, 28], [74, 222, 128], [235, 255, 241]],
  kills: [[74, 14, 14], [239, 68, 68], [255, 228, 186]],
  deaths: [[44, 24, 82], [167, 139, 250], [242, 238, 255]],
};

function boxBlur(src: Float32Array, n: number, r: number) {
  const tmp = new Float32Array(src.length);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        if (xx < 0 || xx >= n) continue;
        s += src[y * n + xx];
        c++;
      }
      tmp[y * n + x] = s / c;
    }
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        if (yy < 0 || yy >= n) continue;
        s += tmp[yy * n + x];
        c++;
      }
      src[y * n + x] = s / c;
    }
  }
}

// p99 rather than max - one loot pile shouldn't flatten the rest of the map.
function upperBound(g: Float32Array) {
  const hot = Array.from(g).filter((v) => v > 0).sort((a, b) => a - b);
  if (!hot.length) return 0;
  return hot[Math.min(hot.length - 1, Math.floor(hot.length * 0.99))];
}

const mix = (a: Stop, b: Stop, t: number): Stop => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export function buildHeat(
  mode: HeatMode,
  paths: JourneyGeometry[],
  eventTypes: string[],
): ImageData | null {
  if (mode === "off" || paths.length === 0) return null;

  const g = new Float32Array(GRID * GRID);
  const add = (wx: number, wy: number) => {
    const x = Math.min(GRID - 1, Math.max(0, ((wx / WORLD) * GRID) | 0));
    const y = Math.min(GRID - 1, Math.max(0, ((wy / WORLD) * GRID) | 0));
    g[y * GRID + x] += 1;
  };

  if (mode === "traffic") {
    for (const j of paths) for (const c of j.coords) add(c[0], c[1]);
  } else {
    const keep =
      mode === "loot"
        ? (t: string) => t === "Loot"
        : mode === "kills"
          ? (t: string) => KILL.has(t)
          : (t: string) => DEATH.has(t);
    for (const j of paths) {
      for (const e of j.journey.ev) {
        if (keep(eventTypes[e[3]])) add(e[0] * WORLD, e[1] * WORLD);
      }
    }
  }

  boxBlur(g, GRID, 3);
  boxBlur(g, GRID, 3);

  const top = upperBound(g);
  if (top <= 0) return null;

  const ramp = RAMPS[mode];
  const out = new Uint8ClampedArray(GRID * GRID * 4);
  for (let i = 0; i < g.length; i++) {
    const t = Math.min(1, g[i] / top);
    if (t <= 0.002) continue;
    const e = Math.pow(t, 0.55); // lift the low end so cold areas still read
    const c = e < 0.5 ? mix(ramp[0], ramp[1], e * 2) : mix(ramp[1], ramp[2], (e - 0.5) * 2);
    const o = i * 4;
    out[o] = c[0];
    out[o + 1] = c[1];
    out[o + 2] = c[2];
    out[o + 3] = e * 235;
  }
  return new ImageData(out, GRID, GRID);
}
