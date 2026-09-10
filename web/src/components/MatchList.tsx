import { useMemo, useState } from "react";
import type { MatchRow } from "../lib/filters";

interface Props {
  rows: MatchRow[];
  selected: string | null;
  onSelect: (id: string) => void;
}

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
const shortId = (id: string) => id.slice(0, 8);

export default function MatchList({ rows, selected, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [multiOnly, setMultiOnly] = useState(false);

  const multiTotal = useMemo(() => rows.filter((r) => r.players > 1).length, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (multiOnly && r.players < 2) return false;
      return !q || r.id.toLowerCase().includes(q);
    });
  }, [rows, query, multiOnly]);

  return (
    <section className="block">
      <h2>
        Match
        <span className="n">{shown.length}</span>
      </h2>

      <input
        className="search"
        placeholder="search match id"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <label className="row">
        <input
          type="checkbox"
          checked={multiOnly}
          onChange={(e) => setMultiOnly(e.target.checked)}
        />
        More than one player
        <em>{multiTotal}</em>
      </label>

      <div className="matchlist">
        {shown.length === 0 && <p className="hint">No matches</p>}
        {shown.map((r) => (
          <button
            key={r.id}
            className={r.id === selected ? "match on" : "match"}
            onClick={() => onSelect(r.id)}
          >
            <span className="mid">
              {shortId(r.id)}
              {r.players > 1 && <i className="badge">{r.players}p</i>}
            </span>
            <small>
              {r.date.slice(8)} Feb · {mmss(r.dur)} · {r.humans}H {r.bots}B · {r.events} ev
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
