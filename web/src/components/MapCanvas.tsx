import { useCallback, useEffect, useRef, useState } from "react";
import { WORLD, type Bounds, type JourneyGeometry } from "../lib/data";
import { css, EVENT_COLOR, EVENT_LABEL, HUMAN, BOT } from "../lib/colors";
import type { MarkerPoint } from "../lib/filters";

interface Props {
  bitmap: ImageBitmap | null;
  paths: JourneyGeometry[];
  markers: MarkerPoint[];
  showPaths: boolean;
  dim: number;
  pathAlpha: number;
  heat: ImageData | null;
  time: number | null; // null = whole match, otherwise seconds since match start
  bounds: Bounds | null;
  selected: number | null;
  onSelect: (i: number | null) => void;
  fitToken: number;
}

interface View { cx: number; cy: number; scale: number }

const MAX_DPR = 2;
const MARKER_R = 2.6;
const HIT_R = 7;

const FULL: Bounds = { minX: 0, minY: 0, maxX: WORLD, maxY: WORLD };

function fitTo(w: number, h: number, b: Bounds | null) {
  const box = b ?? FULL;
  const bw = Math.max(1, box.maxX - box.minX);
  const bh = Math.max(1, box.maxY - box.minY);
  return {
    scale: Math.min(w / bw, h / bh) * 0.96,
    cx: (box.minX + box.maxX) / 2,
    cy: (box.minY + box.maxY) / 2,
  };
}

// Squared distance from a point to a line segment. Position samples are 5s
// apart, so a route is mostly long straight segments - testing only the
// vertices would miss clicks on the visible line between them.
function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  return (px - qx) ** 2 + (py - qy) ** 2;
}

// How many samples of a journey have happened by t. times is sorted.
function upTo(times: number[], t: number) {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export default function MapCanvas({
  bitmap, paths, markers, showPaths, dim, pathAlpha, heat, time, bounds,
  selected, onSelect, fitToken,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ cx: WORLD / 2, cy: WORLD / 2, scale: 0.5 });
  const size = useRef({ w: 0, h: 0 });
  const dragging = useRef(false);
  const frame = useRef(0);

  const [hover, setHover] = useState<{ m: MarkerPoint; x: number; y: number } | null>(null);
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const heatCanvas = useRef<HTMLCanvasElement | null>(null);
  const baseCanvas = useRef<HTMLCanvasElement | null>(null);
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const pathsRef = useRef(paths);
  pathsRef.current = paths;
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  // One Path2D per journey, built once in world space. Stroked separately so
  // overlapping routes build up alpha - that density is the whole point.
  const pathCache = useRef<{ path: Path2D; bot: boolean }[]>([]);
  useEffect(() => {
    const build = (step: number) =>
      paths
        .filter((g) => g.coords.length > 1)
        .map((g) => {
          const p = new Path2D();
          p.moveTo(g.coords[0][0], g.coords[0][1]);
          for (let i = step; i < g.coords.length; i += step) p.lineTo(g.coords[i][0], g.coords[i][1]);
          const last = g.coords[g.coords.length - 1];
          p.lineTo(last[0], last[1]);
          return { path: p, bot: !!g.journey.bot };
        });
    pathCache.current = build(1);
    schedule();
  }, [paths]); // eslint-disable-line react-hooks/exhaustive-deps

  const draw = useCallback(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;

    const { w, h } = size.current;
    const { cx, cy, scale } = view.current;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // world -> screen
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    // "high" smoothing costs 14-21ms a frame under this transform; the default
    // is 5-6ms and looks the same at these scales.
    if (baseCanvas.current) {
      ctx.drawImage(baseCanvas.current, 0, 0, WORLD, WORLD);
    }

    if (heatCanvas.current) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(heatCanvas.current, 0, 0, WORLD, WORLD);
    }

    if (showPaths && time === null) {
      ctx.lineWidth = 1 / scale; // constant 1px on screen
      ctx.lineJoin = "round";
      ctx.globalAlpha = pathAlpha;
      const cache = pathCache.current;
      let current = "";
      for (let i = 0; i < cache.length; i++) {
        if (selected !== null && i === selected) continue;
        const { path, bot } = cache[i];
        const color = bot ? css(BOT) : css(HUMAN);
        if (color !== current) {
          ctx.strokeStyle = color;
          current = color;
        }
        ctx.globalAlpha = selected === null ? pathAlpha : pathAlpha * 0.25;
        ctx.stroke(path);
      }
      if (selected !== null && cache[selected]) {
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2 / scale;
        ctx.strokeStyle = cache[selected].bot ? css(BOT) : css(HUMAN);
        ctx.stroke(cache[selected].path);
      }
      ctx.globalAlpha = 1;
    } else if (showPaths && time !== null) {
      // Scrubbing: redraw each route only as far as the clock has reached.
      ctx.lineWidth = 1 / scale;
      ctx.lineJoin = "round";
      ctx.globalAlpha = Math.min(pathAlpha * 1.6, 0.75);
      for (const g of paths) {
        const n = upTo(g.times, time);
        if (n < 2) continue;
        const p = new Path2D();
        p.moveTo(g.coords[0][0], g.coords[0][1]);
        for (let i = 1; i < n; i++) p.lineTo(g.coords[i][0], g.coords[i][1]);
        ctx.strokeStyle = g.journey.bot ? css(BOT) : css(HUMAN);
        ctx.stroke(p);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Markers in screen space so radius stays constant.
    ctx.save();
    ctx.scale(dpr, dpr);
    const byType = new Map<string, Path2D>();
    const storm = new Path2D();
    for (const m of markers) {
      if (time !== null && m.t > time) continue;
      const sx = (m.position[0] - cx) * scale + w / 2;
      const sy = (m.position[1] - cy) * scale + h / 2;
      if (sx < -10 || sy < -10 || sx > w + 10 || sy > h + 10) continue;
      const r = m.type === "KilledByStorm" ? MARKER_R * 1.7 : MARKER_R;
      let p = byType.get(m.type);
      if (!p) byType.set(m.type, (p = new Path2D()));
      p.moveTo(sx + r, sy);
      p.arc(sx, sy, r, 0, Math.PI * 2);
      if (m.type === "KilledByStorm") {
        storm.moveTo(sx + r + 3, sy);
        storm.arc(sx, sy, r + 3, 0, Math.PI * 2);
      }
    }
    ctx.globalAlpha = 0.85;
    for (const [type, p] of byType) {
      ctx.fillStyle = css(EVENT_COLOR[type] ?? [200, 200, 200]);
      ctx.fill(p);
    }
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 1;
    ctx.strokeStyle = css(EVENT_COLOR.KilledByStorm);
    ctx.stroke(storm);

    // Where everyone actually is at this instant.
    if (time !== null) {
      // Smaller dots when the whole map plays back at once, larger for one match.
      const hr = paths.length > 150 ? 2 : 3.6;
      const heads = { human: new Path2D(), bot: new Path2D() };
      for (const g of paths) {
        const n = upTo(g.times, time);
        if (n < 1) continue;
        const [wx, wy] = g.coords[n - 1];
        const sx = (wx - cx) * scale + w / 2;
        const sy = (wy - cy) * scale + h / 2;
        const p = g.journey.bot ? heads.bot : heads.human;
        p.moveTo(sx + hr, sy);
        p.arc(sx, sy, hr, 0, Math.PI * 2);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = css(HUMAN);
      ctx.fill(heads.human);
      ctx.fillStyle = css(BOT);
      ctx.fill(heads.bot);
    }
    ctx.restore();
  }, [bitmap, markers, showPaths, dim, pathAlpha, time, paths, heat, selected]);

  // schedule must stay referentially stable - it is a dep of the resize and
  // pointer effects, and during playback draw() changes every frame.
  const drawRef = useRef(draw);
  drawRef.current = draw;

  const schedule = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      drawRef.current();
    });
  }, []);

  // The art and its dimming never change while panning, so bake them together.
  useEffect(() => {
    if (!bitmap) {
      baseCanvas.current = null;
      schedule();
      return;
    }
    const c = document.createElement("canvas");
    c.width = bitmap.width;
    c.height = bitmap.height;
    const bctx = c.getContext("2d")!;
    bctx.drawImage(bitmap, 0, 0);
    if (dim > 0) {
      bctx.fillStyle = `rgba(6, 8, 12, ${dim})`;
      bctx.fillRect(0, 0, c.width, c.height);
    }
    baseCanvas.current = c;
    schedule();
  }, [bitmap, dim, schedule]);

  useEffect(() => {
    if (!heat) {
      heatCanvas.current = null;
    } else {
      const c = document.createElement("canvas");
      c.width = heat.width;
      c.height = heat.height;
      c.getContext("2d")!.putImageData(heat, 0, 0);
      heatCanvas.current = c;
    }
    schedule();
  }, [heat, schedule]);

  useEffect(() => {
    schedule();
  }, [draw, schedule]);

  // size + dpr
  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.max(1, Math.round(e.contentRect.width));
      const h = Math.max(1, Math.round(e.contentRect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      if (size.current.w === w && size.current.h === h) return;
      const first = size.current.w === 0;
      size.current = { w, h };
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      if (first) view.current = { ...fitTo(w, h, boundsRef.current) };
      schedule();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [schedule]);

  useEffect(() => {
    const { w, h } = size.current;
    if (!w) return;
    view.current = { ...fitTo(w, h, bounds) };
    schedule();
  }, [fitToken, bounds, schedule]);

  // interaction
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;

    let lastX = 0;
    let lastY = 0;

    let downX = 0;
    let downY = 0;

    const onDown = (e: PointerEvent) => {
      dragging.current = true;
      lastX = downX = e.clientX;
      lastY = downY = e.clientY;
      try { cv.setPointerCapture(e.pointerId); } catch { /* capture is optional */ }
      setHover(null);
    };

    const onMove = (e: PointerEvent) => {
      const rect = cv.getBoundingClientRect();
      if (dragging.current) {
        const { scale } = view.current;
        view.current.cx -= (e.clientX - lastX) / scale;
        view.current.cy -= (e.clientY - lastY) / scale;
        lastX = e.clientX;
        lastY = e.clientY;
        schedule();
        return;
      }
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { cx, cy, scale } = view.current;
      const { w, h } = size.current;
      let best: MarkerPoint | null = null;
      let bestD = HIT_R * HIT_R;
      for (const m of markersRef.current) {
        const sx = (m.position[0] - cx) * scale + w / 2;
        const sy = (m.position[1] - cy) * scale + h / 2;
        const d = (sx - mx) ** 2 + (sy - my) ** 2;
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }
      setHover(best ? { m: best, x: mx, y: my } : null);
    };

    const onUp = (e: PointerEvent) => {
      dragging.current = false;
      try { cv.releasePointerCapture(e.pointerId); } catch { /* never block the click */ }
      if (Math.abs(e.clientX - downX) > 4 || Math.abs(e.clientY - downY) > 4) return;

      const rect = cv.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { cx, cy, scale } = view.current;
      const { w, h } = size.current;
      let best = -1;
      let bestD = 64; // 8px in screen space
      pathsRef.current.forEach((g, idx) => {
        let ax = 0;
        let ay = 0;
        for (let i = 0; i < g.coords.length; i++) {
          const bx = (g.coords[i][0] - cx) * scale + w / 2;
          const by = (g.coords[i][1] - cy) * scale + h / 2;
          if (i > 0) {
            const d = distToSeg(mx, my, ax, ay, bx, by);
            if (d < bestD) {
              bestD = d;
              best = idx;
            }
          }
          ax = bx;
          ay = by;
        }
      });
      selectRef.current(best >= 0 ? best : null);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { w, h } = size.current;
      const v = view.current;
      const min = fitTo(w, h, boundsRef.current).scale * 0.85;
      const next = Math.min(Math.max(v.scale * Math.exp(-e.deltaY * 0.0015), min), min * 40);
      // keep the point under the cursor fixed
      const wx = (mx - w / 2) / v.scale + v.cx;
      const wy = (my - h / 2) / v.scale + v.cy;
      v.cx = wx - (mx - w / 2) / next;
      v.cy = wy - (my - h / 2) / next;
      v.scale = next;
      schedule();
    };

    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointerleave", () => setHover(null));
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("wheel", onWheel);
    };
  }, [schedule]);

  const mmss = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

  return (
    <div className="canvas-wrap" ref={wrap}>
      <canvas ref={canvas} className={dragging.current ? "grabbing" : ""} />
      {hover && (
        <div
          className="tip"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <b>{EVENT_LABEL[hover.m.type] ?? hover.m.type}</b>
          <span>
            {hover.m.bot ? "Bot" : "Human"} · {mmss(hover.m.t)} into match
          </span>
        </div>
      )}
    </div>
  );
}
