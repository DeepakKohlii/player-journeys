import { css, HUMAN, BOT } from "../lib/colors";
import { toggle, type Filters, type MatchRow } from "../lib/filters";
import MatchList from "./MatchList";

interface Props {
  dates: string[];
  matches: MatchRow[];
  filters: Filters;
  onChange: (f: Filters) => void;
}

const dayLabel = (d: string) => `${d.slice(8)} Feb`;

export default function DataPanel({ dates, matches, filters, onChange }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <aside className="panel left">
      {filters.mode === "match" ? (
        <MatchList
          rows={matches}
          selected={filters.matchId}
          onSelect={(id) => set({ matchId: id })}
        />
      ) : (
        <section className="block">
          <h2>
            Date
            {filters.dates.length > 0 && (
              <button className="clear" onClick={() => set({ dates: [] })}>
                reset
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
          {filters.dates.length === 0 && <p className="hint">All five days</p>}
        </section>
      )}

      <section className="block">
        <h2>Who</h2>
        <label className="row">
          <input
            type="checkbox"
            checked={filters.humans}
            onChange={(e) => set({ humans: e.target.checked })}
          />
          <span className="swatch" style={{ background: css(HUMAN), color: css(HUMAN) }} />
          Humans
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={filters.bots}
            onChange={(e) => set({ bots: e.target.checked })}
          />
          <span className="swatch" style={{ background: css(BOT), color: css(BOT) }} />
          Bots
        </label>
      </section>
    </aside>
  );
}
