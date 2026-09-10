import { useCallback, useEffect, useRef, useState } from "react";
import { WORLD, type JourneyGeometry } from "../lib/data";
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
  fitToken: number;
}

interface View { cx: number; cy: number; scale: number }

const MAX_DPR = 2;
const MARKER_R = 2.6;
const HIT_R = 7;

const fitScale = (w: number, h: number) => (Math.min(w, h) * 0.94) / WORLD;

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
  bitmap, paths, markers, showPaths, dim, pathAlpha, heat, time, fitToken,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ cx: WORLD / 2, cy: WORLD / 2, scale: 0.5 });
  const size = useRef({ w: 0, h: 0 });
  const dragging = useRef(false);
  const frame = useRef(0);
  const interacting = useRef(false);
  const idleTimer = useRef(0);

  const [hover, setHover] = useState<{ m: MarkerPoint; x: number; y: number } | null>(null);
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const heatCanvas = useRef<HTMLCanvasElement | null>(null);

  // One Path2D per journey, built once in world space. Stroked separately so
  // overlapping routes build up alpha - that density is the whole point.
  const pathCache = useRef<{ path: Path2D; bot: boolean }[]>([]);
  useEffect(() => {
    pathCache.current = paths
      .filter((g) => g.coords.length > 1)
      .map((g) => {
        const p = new Path2D();
        p.moveTo(g.coords[0][0], g.coords[0][1]);
        for (let i = 1; i < g.coords.length; i++) p.lineTo(g.coords[i][0], g.coords[i][1]);
        return { path: p, bot: !!g.journey.bot };
      });
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

    if (bitmap) {
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, WORLD, WORLD);
      // Knock the art back so routes and markers are not camouflaged by it.
      if (dim > 0) {
        ctx.fillStyle = `rgba(6, 8, 12, ${dim})`;
        ctx.fillRect(0, 0, WORLD, WORLD);
      }
    }

    if (heatCanvas.current) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(heatCanvas.current, 0, 0, WORLD, WORLD);
    }

    if (showPaths && time === null) {
      ctx.lineWidth = 1 / scale; // constant 1px on screen
      ctx.lineJoin = "round";
      ctx.globalAlpha = pathAlpha;
      // Skip half the routes mid-drag so panning stays responsive.
      const step = interacting.current && pathCache.current.length > 250 ? 2 : 1;
      let current = "";
      for (let i = 0; i < pathCache.current.length; i += step) {
        const { path, bot } = pathCache.current[i];
        const color = bot ? css(BOT) : css(HUMAN);
        if (color !== current) {
          ctx.strokeStyle = color;
          current = color;
        }
        ctx.stroke(path);
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
    const r = interacting.current ? MARKER_R * 0.8 : MARKER_R;
    const byType = new Map<string, Path2D>();
    for (const m of markers) {
      if (time !== null && m.t > time) continue;
      const sx = (m.position[0] - cx) * scale + w / 2;
      const sy = (m.position[1] - cy) * scale + h / 2;
      if (sx < -8 || sy < -8 || sx > w + 8 || sy > h + 8) continue;
      let p = byType.get(m.type);
      if (!p) byType.set(m.type, (p = new Path2D()));
      p.moveTo(sx + r, sy);
      p.arc(sx, sy, r, 0, Math.PI * 2);
    }
    ctx.globalAlpha = 0.85;
    for (const [type, p] of byType) {
      ctx.fillStyle = css(EVENT_COLOR[type] ?? [200, 200, 200]);
      ctx.fill(p);
    }

    // Where everyone actually is at this instant.
    if (time !== null) {
      // Shrink the dots when the whole map is playing back at once.
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
  }, [bitmap, markers, showPaths, dim, pathAlpha, time, paths, heat]);

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

  const markInteracting = useCallback(() => {
    interacting.current = true;
    clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      interacting.current = false;
      schedule();
    }, 140);
  }, [schedule]);

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
      if (first) view.current.scale = fitScale(w, h);
      schedule();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [schedule]);

  useEffect(() => {
    const { w, h } = size.current;
    if (!w) return;
    view.current = { cx: WORLD / 2, cy: WORLD / 2, scale: fitScale(w, h) };
    schedule();
  }, [fitToken, schedule]);

  // interaction
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;

    let lastX = 0;
    let lastY = 0;

    const onDown = (e: PointerEvent) => {
      dragging.current = true;
      lastX = e.clientX;
      lastY = e.clientY;
      cv.setPointerCapture(e.pointerId);
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
        markInteracting();
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
      cv.releasePointerCapture(e.pointerId);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { w, h } = size.current;
      const v = view.current;
      const min = fitScale(w, h) * 0.9;
      const next = Math.min(Math.max(v.scale * Math.exp(-e.deltaY * 0.0015), min), min * 40);
      // keep the point under the cursor fixed
      const wx = (mx - w / 2) / v.scale + v.cx;
      const wy = (my - h / 2) / v.scale + v.cy;
      v.cx = wx - (mx - w / 2) / next;
      v.cy = wy - (my - h / 2) / next;
      v.scale = next;
      markInteracting();
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
  }, [schedule, markInteracting]);

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
