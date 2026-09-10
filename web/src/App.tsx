import { useEffect, useMemo, useState } from "react";
import { loadIndex, loadMap, toGeometry, WORLD } from "./lib/data";
import {
  countEvents, datesOf, defaultFilters, filterJourneys, markersOf, type Filters,
} from "./lib/filters";
import FilterRail from "./components/FilterRail";
import MapCanvas from "./components/MapCanvas";
import type { DataIndex, MapPayload } from "./types";
import "./App.css";

export default function App() {
  const [index, setIndex] = useState<DataIndex | null>(null);
  const [mapId, setMapId] = useState("AmbroseValley");
  const [payload, setPayload] = useState<MapPayload | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [fitToken, setFitToken] = useState(0);

  useEffect(() => {
    loadIndex().then(setIndex);
  }, []);

  useEffect(() => {
    let live = true;
    setPayload(null);
    setFilters(defaultFilters());
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

  return (
    <div className="app">
      <FilterRail
        maps={index?.maps ?? []}
        mapId={mapId}
        onMapChange={setMapId}
        payload={payload}
        dates={dates}
        counts={counts}
        filters={filters}
        onChange={setFilters}
      />

      <main className="stage">
        {!payload && <div className="loading">Loading…</div>}

        <MapCanvas
          bitmap={bitmap}
          paths={geometry}
          markers={markers}
          showPaths={filters.showPaths}
          dim={filters.dim}
          pathAlpha={filters.pathAlpha}
          fitToken={fitToken}
        />

        {payload && (
          <button className="reset" onClick={() => setFitToken((n) => n + 1)}>
            Reset view
          </button>
        )}

        {payload && (
          <div className="readout">
            <b>{matchCount.toLocaleString()}</b> matches
            <span />
            <b>{journeys.length.toLocaleString()}</b> journeys
            <span />
            <b>{markers.length.toLocaleString()}</b> events shown
          </div>
        )}
      </main>
    </div>
  );
}
