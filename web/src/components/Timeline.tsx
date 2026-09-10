interface Props {
  time: number | null; // null means show the whole match
  maxT: number;
  playing: boolean;
  speed: number;
  onSeek: (t: number | null) => void;
  onPlay: () => void;
  onSpeed: (s: number) => void;
}

const SPEEDS = [1, 4, 10];
const mmss = (t: number) =>
  `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export default function Timeline({
  time, maxT, playing, speed, onSeek, onPlay, onSpeed,
}: Props) {
  const showing = time ?? maxT;

  return (
    <div className="timeline">
      <button className="play" onClick={onPlay} title={playing ? "Pause" : "Play"}>
        {playing ? "❚❚" : "▶"}
      </button>

      <span className="clock">{mmss(showing)}</span>

      <input
        type="range"
        min={0}
        max={maxT}
        step={1}
        value={showing}
        onChange={(e) => onSeek(Number(e.target.value))}
      />

      <span className="clock dim">{mmss(maxT)}</span>

      <div className="speeds">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={s === speed ? "sp on" : "sp"}
            onClick={() => onSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>

      <button
        className="sp"
        onClick={() => onSeek(null)}
        disabled={time === null}
        title="Show the whole match again"
      >
        All
      </button>
    </div>
  );
}
