import { useEffect, useRef, useState } from "react";
import { loadMap, WORLD } from "../lib/data";
import "./Hero.css";

interface Props {
  onEnter: () => void;
}

interface Line { pts: [number, number][]; bot: boolean }

const STATS = [
  { n: "89,104", l: "events" },
  { n: "1,243", l: "journeys" },
  { n: "796", l: "matches" },
  { n: "339", l: "players" },
  { n: "3", l: "maps" },
  { n: "5", l: "days" },
];

export default function Hero({ onEnter }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const lines = useRef<Line[]>([]);
  const [ready, setReady] = useState(false);

  // Grand Rift is the smallest payload, so the hero paints real routes fast.
  useEffect(() => {
    let live = true;
    loadMap("GrandRift").then((p) => {
      if (!live) return;
      lines.current = p.journeys
        .filter((j) => j.path.length >= 18)
        .slice(0, 150)
        .map((j) => {
          const pts: [number, number][] = [];
          for (let i = 0; i < j.path.length; i += 3) pts.push([j.path[i], j.path[i + 1]]);
          return { pts, bot: !!j.bot };
        });
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx || !ready) return;

    let raf = 0;
    let t0 = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      cv.width = cv.clientWidth * dpr;
      cv.height = cv.clientHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const frame = (now: number) => {
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      const cycle = 11000;
      let p = ((now - t0) % cycle) / cycle;
      if (p > 0.86) p = 1; // hold the finished picture briefly

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const s = Math.max(w, h) * 0.95;
      const ox = (w - s) / 2;
      const oy = (h - s) / 2;
      const grow = Math.min(1, p / 0.86);

      ctx.lineWidth = 1;
      ctx.lineJoin = "round";
      for (const ln of lines.current) {
        const n = Math.max(2, Math.floor(ln.pts.length * grow));
        ctx.beginPath();
        ctx.moveTo(ox + ln.pts[0][0] * s, oy + ln.pts[0][1] * s);
        for (let i = 1; i < n; i++) {
          ctx.lineTo(ox + ln.pts[i][0] * s, oy + ln.pts[i][1] * s);
        }
        ctx.strokeStyle = ln.bot ? "rgba(255,46,136,.34)" : "rgba(0,229,255,.4)";
        ctx.stroke();

        // leading point
        const head = ln.pts[n - 1];
        ctx.beginPath();
        ctx.arc(ox + head[0] * s, oy + head[1] * s, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = ln.bot ? "rgba(255,46,136,.9)" : "rgba(0,229,255,.95)";
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      t0 = 0;
    };
  }, [ready]);

  return (
    <div className="hero">
      <canvas ref={canvas} className="herocanvas" />
      <div className="scan" />
      <div className="vig" />

      <div className="herobody">
        <p className="kicker">LILA Games · Level design telemetry</p>

        <h1 className="title" data-text="BLACKBOX">
          BLACKBOX
        </h1>

        <p className="tag">
          Five days of production match data from <b>LILA BLACK</b>.
          Every route, every kill, every crate — on the map where it happened.
        </p>

        <div className="herostats">
          {STATS.map((s) => (
            <div key={s.l}>
              <b>{s.n}</b>
              <span>{s.l}</span>
            </div>
          ))}
        </div>

        <button className="enter" onClick={onEnter}>
          <span>Open console</span>
        </button>

        <p className="foot">{WORLD > 0 ? "AmbroseValley · GrandRift · Lockdown" : ""}</p>
      </div>
    </div>
  );
}
