import type { MapIndexEntry, MapPayload } from "../types";
import { css, EVENT_COLOR, EVENT_LABEL, HUMAN, BOT, MARKER_EVENTS } from "../lib/colors";
import { toggle, type Filters, type MatchRow } from "../lib/filters";
import MatchList from "./MatchList";

interface Props {
  maps: MapIndexEntry[];
  mapId: string;
  onMapChange: (id: string) => void;
  payload: MapPayload | null;
  dates: string[];
  counts: Record<string, number>;
  matches: MatchRow[];
  filters: Filters;
  onChange: (f: Filters) => void;
}

const dayLabel = (d: string) => d.slice(8) + " Feb";

export default function FilterRail(props: Props) {
  const { maps, mapId, onMapChange, dates, counts, matches, filters, onChange } = props;
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <aside className="rail">
      <div className="brand">
        <span className="dot" />
        LILA BLACK
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
          onClick={() =>
            set({ mode: "match", matchId: filters.matchId ?? matches[0]?.id ?? null })
          }
        >
          Match
        </button>
      </div>

      <section>
        <h2>Map</h2>
        {maps.map((m) => (
          <button
            key={m.mapId}
            className={m.mapId === mapId ? "card active" : "card"}
            onClick={() => onMapChange(m.mapId)}
          >
            <span>{m.label}</span>
            <small>{m.matches} matches</small>
          </button>
        ))}
      </section>

      {filters.mode === "match" ? (
        <MatchList
          rows={matches}
          selected={filters.matchId}
          onSelect={(id) => set({ matchId: id })}
        />
      ) : (
      <section>
        <h2>
          Date
          {filters.dates.length > 0 && (
            <button className="clear" onClick={() => set({ dates: [] })}>
              clear
            </button>
          )}
        </h2>
        <div className="chips">
          {dates.map((d) => (
            <button
              key={d}
              className={filters.dates.includes(d) ? "chip on" : "chip"}
              onClick={() => set({ dates: toggle(filters.dates, d) })}
            >
              {dayLabel(d)}
            </button>
          ))}
        </div>
        {filters.dates.length === 0 && <p className="hint">All dates</p>}
      </section>
      )}

      <section>
        <h2>Who</h2>
        <label className="row">
          <input
            type="checkbox"
            checked={filters.humans}
            onChange={(e) => set({ humans: e.target.checked })}
          />
          <span className="swatch" style={{ background: css(HUMAN) }} />
          Humans
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={filters.bots}
            onChange={(e) => set({ bots: e.target.checked })}
          />
          <span className="swatch" style={{ background: css(BOT) }} />
          Bots
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={filters.showPaths}
            onChange={(e) => set({ showPaths: e.target.checked })}
          />
          <span className="swatch line" />
          Show paths
        </label>
      </section>

      <section>
        <h2>Display</h2>
        <label className="slider">
          Map dimming
          <input
            type="range" min={0} max={0.9} step={0.05}
            value={filters.dim}
            onChange={(e) => set({ dim: Number(e.target.value) })}
          />
        </label>
        <label className="slider">
          Path opacity
          <input
            type="range" min={0.05} max={0.8} step={0.05}
            value={filters.pathAlpha}
            onChange={(e) => set({ pathAlpha: Number(e.target.value) })}
          />
        </label>
      </section>

      <section>
        <h2>Events</h2>
        {MARKER_EVENTS.map((ev) => {
          const n = counts[ev] ?? 0;
          return (
            <label key={ev} className={n === 0 ? "row muted" : "row"}>
              <input
                type="checkbox"
                checked={filters.events.includes(ev)}
                disabled={n === 0}
                onChange={() => set({ events: toggle(filters.events, ev) })}
              />
              <span className="swatch" style={{ background: css(EVENT_COLOR[ev]) }} />
              {EVENT_LABEL[ev]}
              <em>{n.toLocaleString()}</em>
            </label>
          );
        })}
      </section>
    </aside>
  );
}
