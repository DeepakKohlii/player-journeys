import { useEffect, useMemo, useState } from "react";
import { contentBounds, loadIndex, loadMap, toGeometry, WORLD } from "./lib/data";
import {
  countEvents, datesOf, defaultFilters, filterJourneys, markersOf, matchRows, type Filters,
} from "./lib/filters";
import TopBar from "./components/TopBar";
import DataPanel from "./components/DataPanel";
import LayersPanel from "./components/LayersPanel";
import Hero from "./components/Hero";
import MapCanvas from "./components/MapCanvas";
import Timeline from "./components/Timeline";
import { buildHeat } from "./lib/heat";
import type { DataIndex, MapPayload } from "./types";
import "./App.css";

export default function App() {
  const [index, setIndex] = useState<DataIndex | null>(null);
  const [mapId, setMapId] = useState("AmbroseValley");
  const [payload, setPayload] = useState<MapPayload | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const [entered, setEntered] = useState(() => location.hash === "#console");
  const [openPanel, setOpenPanel] = useState<"left" | "right" | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);

  useEffect(() => {
    loadIndex().then(setIndex);
  }, []);

  // Keeps the browser back button working between hero and console.
  useEffect(() => {
    const onHash = () => setEntered(location.hash === "#console");
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    let live = true;
    setPayload(null);
    setTime(null);
    setPlaying(false);
    // Keep how they're looking at the data; only drop what belongs to the old map.
    setFilters((f) => ({ ...f, dates: [], matchId: null }));
    loadMap(mapId).then((p) => live && setPayload(p));
    return () => {
      live = false;
    };
  }, [mapId]);

  useEffect(() => {
    let live = true;
    setBitmap(null);
    fetch(`${import.meta.env.BASE_URL}maps/${mapId}.webp`)
      .then((r) => r.blob())
      .then(createImageBitmap)
      .then((b) => {
        if (live) {
          setBitmap(b);
          setFitToken((n) => n + 1);
        }
      });
    return () => {
      live = false;
    };
  }, [mapId]);

  const dates = useMemo(() => (payload ? datesOf(payload) : []), [payload]);

  const matches = useMemo(() => (payload ? matchRows(payload) : []), [payload]);

  const bounds = useMemo(() => (payload ? contentBounds(payload) : null), [payload]);

  const selected = useMemo(
    () => (filters.mode === "match" ? matches.find((m) => m.id === filters.matchId) : undefined),
    [matches, filters.mode, filters.matchId],
  );

  const journeys = useMemo(
    () => (payload ? filterJourneys(payload, filters) : []),
    [payload, filters],
  );

  const counts = useMemo(
    () => (payload ? countEvents(payload, journeys) : {}),
    [payload, journeys],
  );

  const geometry = useMemo(() => journeys.map(toGeometry), [journeys]);

  const markers = useMemo(
    () => (payload ? markersOf(payload, journeys, filters, WORLD) : []),
    [payload, journeys, filters],
  );

  const matchCount = useMemo(() => new Set(journeys.map((j) => j.m)).size, [journeys]);

  const heat = useMemo(
    () => (payload ? buildHeat(filters.heat, geometry, payload.eventTypes) : null),
    [payload, geometry, filters.heat],
  );

  // Longest journey in the current selection - every journey starts at 0 because
  // the pipeline rebased each one onto its own match clock.
  const maxT = useMemo(
    () => journeys.reduce((n, j) => Math.max(n, j.dur), 0),
    [journeys],
  );

  // Match mode with nothing selected renders an empty map, so pick one.
  useEffect(() => {
    if (filters.mode !== "match" || filters.matchId || matches.length === 0) return;
    setFilters((f) => ({ ...f, matchId: matches[0].id }));
  }, [filters.mode, filters.matchId, matches]);

  useEffect(() => {
    setTime(null);
    setPlaying(false);
  }, [filters.matchId, filters.mode]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((t) => {
        const next = (t ?? 0) + dt * speed;
        if (next >= maxT) {
          setPlaying(false);
          return maxT;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, maxT]);

  const togglePlay = () => {
    if (!playing && (time === null || time >= maxT)) setTime(0);
    setPlaying((p) => !p);
  };

  if (!entered) {
    return (
      <Hero
        onEnter={() => {
          location.hash = "#console";
          setEntered(true);
        }}
      />
    );
  }

  return (
    <div className={openPanel ? `app drawer-${openPanel}` : "app"}>
      <TopBar
        maps={index?.maps ?? []}
        mapId={mapId}
        onMapChange={setMapId}
        filters={filters}
        onChange={setFilters}
        firstMatchId={matches[0]?.id ?? null}
        matchCount={matchCount}
        journeyCount={journeys.length}
        eventCount={markers.length}
        onToggleLeft={() => setOpenPanel((p) => (p === "left" ? null : "left"))}
        onToggleRight={() => setOpenPanel((p) => (p === "right" ? null : "right"))}
      />

      <DataPanel
        dates={dates}
        matches={matches}
        filters={filters}
        onChange={setFilters}
      />

      <main className="stage">
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />
        {!payload && <div className="loading">loading telemetry</div>}

        <MapCanvas
          bitmap={bitmap}
          paths={geometry}
          markers={markers}
          showPaths={filters.showPaths}
          dim={filters.dim}
          pathAlpha={filters.pathAlpha}
          heat={heat}
          time={time}
          bounds={bounds}
          fitToken={fitToken}
        />

        {payload && (
          <button className="reset" onClick={() => setFitToken((n) => n + 1)}>
            Reset view
          </button>
        )}

        {selected && (
          <div className="selinfo">
            <b>{selected.id.slice(0, 8)}</b>
            <span>{selected.date.slice(8)} Feb</span>
            <span>
              {Math.floor(selected.dur / 60)}:{String(selected.dur % 60).padStart(2, "0")}
            </span>
            <span>{selected.humans}H · {selected.bots}B</span>
            <span>{selected.events} events</span>
          </div>
        )}

        {payload && maxT > 0 && (
          <Timeline
            time={time}
            maxT={maxT}
            playing={playing}
            speed={speed}
            onSeek={(t) => {
              setPlaying(false);
              setTime(t);
            }}
            onPlay={togglePlay}
            onSpeed={setSpeed}
          />
        )}

      </main>

      <LayersPanel counts={counts} filters={filters} onChange={setFilters} />

      {openPanel && <div className="scrim" onClick={() => setOpenPanel(null)} />}
    </div>
  );
}
