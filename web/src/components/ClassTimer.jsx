import { useEffect, useRef, useState } from "react";
import { X, Play, Pause, RotateCcw, Timer, Minimize2, Maximize2 } from "lucide-react";

const PRESETS = [1, 3, 5, 10, 15, 30];
const fmt = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** Three short beeps via Web Audio (no audio file needed). */
function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ac.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.25);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + t);
      o.stop(ac.currentTime + t + 0.3);
    });
    setTimeout(() => ac.close(), 1500);
  } catch {
    /* audio unavailable */
  }
}

export default function ClassTimer({ onClose }) {
  const [mode, setMode] = useState("countdown"); // "countdown" | "stopwatch"
  const [duration, setDuration] = useState(5 * 60 * 1000);
  const [elapsed, setElapsed] = useState(0); // ms accumulated before the current run
  const [startedAt, setStartedAt] = useState(null); // timestamp while running
  const [now, setNow] = useState(Date.now());
  // Phones start with the small pill so the timer doesn't cover the board
  const [compact, setCompact] = useState(() => window.innerWidth < 640);
  const [custom, setCustom] = useState("");
  const done = useRef(false);

  const running = startedAt !== null;
  const total = elapsed + (running ? now - startedAt : 0);
  const remaining = duration - total;
  const finished = mode === "countdown" && remaining <= 0;
  const shown = mode === "countdown" ? remaining : total;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (finished && running && !done.current) {
      done.current = true;
      setElapsed(duration);
      setStartedAt(null);
      beep();
    }
  }, [finished, running, duration]);

  const reset = (nextDuration = duration) => {
    setStartedAt(null);
    setElapsed(0);
    setDuration(nextDuration);
    done.current = false;
  };
  const toggle = () => {
    if (running) {
      setElapsed(total);
      setStartedAt(null);
    } else {
      if (finished) reset();
      const t = Date.now();
      setNow(t);
      setStartedAt(t);
    }
  };
  const switchMode = (m) => {
    setMode(m);
    reset();
  };

  const warn = mode === "countdown" && running && remaining <= 60_000;
  const timeClass = finished ? "text-red-500 animate-pulse" : warn ? "text-amber-500" : "text-zinc-900 dark:text-zinc-50";

  if (compact) {
    return (
      <div className="panel flex items-center gap-1 pl-3 pr-1 py-1">
        <Timer size={15} className={finished ? "text-red-500" : "text-indigo-500"} />
        <span className={`font-mono font-bold tabular-nums text-lg px-1 ${timeClass}`}>{fmt(shown)}</span>
        <button className="icon-btn !w-8 !h-8" onClick={toggle} title={running ? "Pause" : "Start"}>
          {running ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button className="icon-btn !w-8 !h-8" onClick={() => setCompact(false)} title="Expand timer">
          <Maximize2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="panel w-72 p-3 flex flex-col gap-3 text-zinc-700 dark:text-zinc-200" role="timer" aria-live="off">
      <div className="flex items-center gap-1">
        <Timer size={16} className="text-indigo-500" />
        <span className="flex-1 text-sm font-semibold ml-1">Class timer</span>
        <button className="icon-btn !w-8 !h-8" onClick={() => setCompact(true)} title="Minimise">
          <Minimize2 size={14} />
        </button>
        <button className="icon-btn !w-8 !h-8" onClick={onClose} title="Close timer">
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs font-semibold">
        {[
          ["countdown", "Countdown"],
          ["stopwatch", "Stopwatch"],
        ].map(([m, label]) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`py-1.5 rounded-lg transition ${mode === m ? "bg-white dark:bg-zinc-900 shadow-sm" : "text-zinc-500"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={`text-center font-mono font-bold tabular-nums text-5xl ${timeClass}`}>{fmt(shown)}</div>
      {finished && <div className="text-center text-sm font-semibold text-red-500 -mt-2">Time&apos;s up!</div>}

      {mode === "countdown" && !running && (
        <>
          <div className="grid grid-cols-6 gap-1">
            {PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => reset(m * 60_000)}
                className={`h-8 rounded-lg text-xs font-semibold transition ${
                  duration === m * 60_000
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-200"
                    : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                }`}
                title={`${m} minute${m > 1 ? "s" : ""}`}
              >
                {m}m
              </button>
            ))}
          </div>
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const m = parseFloat(custom);
              if (m > 0 && m <= 600) {
                reset(Math.round(m * 60_000));
                setCustom("");
              }
            }}
          >
            <input
              type="number"
              min="0.5"
              max="600"
              step="0.5"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Custom minutes"
              className="flex-1 min-w-0 h-8 px-2.5 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" className="h-8 px-3 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">
              Set
            </button>
          </form>
        </>
      )}

      <div className="flex gap-2">
        <button
          onClick={toggle}
          className="flex-1 h-10 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center gap-1.5"
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
          {running ? "Pause" : finished ? "Restart" : total > 0 ? "Resume" : "Start"}
        </button>
        <button
          onClick={() => reset()}
          className="h-10 w-10 rounded-xl grid place-items-center bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          title="Reset"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}
