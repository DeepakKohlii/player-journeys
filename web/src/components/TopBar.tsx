import type { MapIndexEntry } from "../types";
import type { Filters } from "../lib/filters";

interface Props {
  maps: MapIndexEntry[];
  mapId: string;
  onMapChange: (id: string) => void;
  filters: Filters;
  onChange: (f: Filters) => void;
  firstMatchId: string | null;
  matchCount: number;
  journeyCount: number;
  eventCount: number;
}

export default function TopBar(props: Props) {
  const {
    maps, mapId, onMapChange, filters, onChange, firstMatchId,
    matchCount, journeyCount, eventCount,
  } = props;
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <header className="topbar">
      <div className="logo">
        <b>BLACKBOX</b>
        <i>LILA Black</i>
      </div>

      <nav className="maps">
        {maps.map((m) => (
          <button
            key={m.mapId}
            className={m.mapId === mapId ? "maptab on" : "maptab"}
            onClick={() => onMapChange(m.mapId)}
          >
            {m.label}
            <em>{m.matches}</em>
          </button>
        ))}
      </nav>

      <div className="stats">
        <div className="stat">
          <b>{matchCount.toLocaleString()}</b>
          <span>matches</span>
        </div>
        <div className="stat">
          <b>{journeyCount.toLocaleString()}</b>
          <span>journeys</span>
        </div>
        <div className="stat">
          <b>{eventCount.toLocaleString()}</b>
          <span>events</span>
        </div>
      </div>

      <div className="modes">
        <button
          className={filters.mode === "explore" ? "mode on" : "mode"}
          onClick={() => set({ mode: "explore" })}
        >
          Explore
        </button>
        <button
          className={filters.mode === "match" ? "mode on" : "mode"}
          onClick={() => set({ mode: "match", matchId: filters.matchId ?? firstMatchId })}
        >
          Match
        </button>
      </div>
    </header>
  );
}
