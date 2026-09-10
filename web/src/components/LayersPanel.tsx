import { css, EVENT_COLOR, EVENT_LABEL, MARKER_EVENTS } from "../lib/colors";
import { toggle, type Filters } from "../lib/filters";
import { HEAT_MODES } from "../lib/heat";

interface Props {
  counts: Record<string, number>;
  filters: Filters;
  onChange: (f: Filters) => void;
}

const HEAT_TINT: Record<string, string> = {
  off: "#43506a",
  traffic: "#00e5ff",
  loot: "#4ade80",
  kills: "#ef4444",
  deaths: "#a78bfa",
};

export default function LayersPanel({ counts, filters, onChange }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <aside className="panel right">
      <section className="block">
        <h2>Heatmap</h2>
        <div className="heat">
          {HEAT_MODES.map((m) => (
            <button
              key={m.id}
              className={filters.heat === m.id ? "heatbtn on" : "heatbtn"}
              onClick={() => set({ heat: m.id })}
            >
              <s style={{ background: HEAT_TINT[m.id] }} />
              {m.label}
            </button>
          ))}
        </div>
      </section>

      <section className="block">
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
              <span
                className="swatch"
                style={{ background: css(EVENT_COLOR[ev]), color: css(EVENT_COLOR[ev]) }}
              />
              {EVENT_LABEL[ev]}
              <em>{n.toLocaleString()}</em>
            </label>
          );
        })}
      </section>

      <section className="block">
        <h2>Render</h2>
        <label className="row">
          <input
            type="checkbox"
            checked={filters.showPaths}
            onChange={(e) => set({ showPaths: e.target.checked })}
          />
          <span className="swatch line" />
          Show routes
        </label>
        <label className="slider">
          <span>
            Map dimming <b>{Math.round(filters.dim * 100)}%</b>
          </span>
          <input
            type="range" min={0} max={0.9} step={0.05}
            value={filters.dim}
            onChange={(e) => set({ dim: Number(e.target.value) })}
          />
        </label>
        <label className="slider">
          <span>
            Route opacity <b>{Math.round(filters.pathAlpha * 100)}%</b>
          </span>
          <input
            type="range" min={0.05} max={0.8} step={0.05}
            value={filters.pathAlpha}
            onChange={(e) => set({ pathAlpha: Number(e.target.value) })}
          />
        </label>
      </section>
    </aside>
  );
}
