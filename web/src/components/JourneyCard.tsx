import { css, EVENT_COLOR, EVENT_LABEL } from "../lib/colors";
import type { Journey } from "../types";

interface Props {
  journey: Journey;
  eventTypes: string[];
  onClose: () => void;
}

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

export default function JourneyCard({ journey, eventTypes, onClose }: Props) {
  const counts: Record<string, number> = {};
  for (const e of journey.ev) {
    const t = eventTypes[e[3]];
    counts[t] = (counts[t] ?? 0) + 1;
  }
  const last = journey.ev.length ? eventTypes[journey.ev[journey.ev.length - 1][3]] : null;
  const died = last && last !== "Loot" && last !== "BotKill" && last !== "Kill";
  const samples = journey.path.length / 3;

  return (
    <div className="jcard">
      <header>
        <b>{journey.bot ? "Bot" : "Human"} {journey.uid.slice(0, 8)}</b>
        <button onClick={onClose} aria-label="Clear selection">✕</button>
      </header>
      <dl>
        <div><dt>Alive</dt><dd>{mmss(journey.dur)}</dd></div>
        <div><dt>Samples</dt><dd>{samples}</dd></div>
        <div><dt>Ended</dt><dd>{died ? EVENT_LABEL[last] ?? last : "extracted or timed out"}</dd></div>
      </dl>
      <ul>
        {Object.entries(counts).map(([t, n]) => (
          <li key={t}>
            <span style={{ background: css(EVENT_COLOR[t] ?? [150, 150, 150]) }} />
            {EVENT_LABEL[t] ?? t}
            <em>{n}</em>
          </li>
        ))}
        {journey.ev.length === 0 && <li className="none">No events recorded</li>}
      </ul>
    </div>
  );
}
