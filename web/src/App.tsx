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
import { decode, encode } from "./lib/urlState";
import JourneyCard from "./components/JourneyCard";
import type { DataIndex, MapPayload } from "./types";
import "./App.css";

export default function App() {
  const [index, setIndex] = useState<DataIndex | null>(null);
  const initial = useMemo(() => decode(location.hash, "AmbroseValley"), []);
  const [mapId, setMapId] = useState(initial.mapId);
  const [payload, setPayload] = useState<MapPayload | null>(null);
  const [filters, setFilters] = useState<Filters>(initial.filters);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const [entered, setEntered] = useState(() => location.hash.startsWith("#console"));
  const [picked, setPicked] = useState<number | null>(null);
  const [openPanel, setOpenPanel] = useState<"left" | "right" | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);

  useEffect(() => {
    loadIndex().then(setIndex);
  }, []);

  // Back button, and re-reading a link pasted into an already open tab.
  // Our own replaceState calls do not fire hashchange, so this cannot loop.
  useEffect(() => {
    const onHash = () => {
      setEntered(location.hash.startsWith("#console"));
      const next = decode(location.hash, mapId);
      setMapId(next.mapId);
      setFilters(next.filters);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, [mapId]);

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

  useEffect(() => {
    if (!entered) return;
    history.replaceState(null, "", encode(mapId, filters));
  }, [entered, mapId, filters]);

  useEffect(() => setPicked(null), [mapId, filters]);

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
          location.hash = encode(mapId, filters).slice(1);
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

        {payload && journeys.length === 0 && (
          <div className="empty">
            <b>Nothing matches these filters</b>
            <p>No journeys on {payload.label} for the current selection.</p>
            <button onClick={() => setFilters(defaultFilters())}>Reset filters</button>
          </div>
        )}

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
          selected={picked}
          onSelect={setPicked}
          fitToken={fitToken}
        />

        {payload && (
          <button className="reset" onClick={() => setFitToken((n) => n + 1)}>
            Reset view
          </button>
        )}

        {picked !== null && journeys[picked] && payload && (
          <JourneyCard
            journey={journeys[picked]}
            eventTypes={payload.eventTypes}
            onClose={() => setPicked(null)}
          />
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
