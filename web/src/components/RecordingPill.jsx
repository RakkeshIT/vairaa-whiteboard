import { useEffect, useState } from "react";
import { Square, MicOff } from "lucide-react";

const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
};

/** Floating "● REC 3:12  [Stop]" indicator while the lesson is being recorded. */
export default function RecordingPill({ startedAt, mic, onStop }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="fixed left-1/2 -translate-x-1/2 top-[var(--ui-top)] z-40 sm:top-[calc(var(--ui-top)+3.5rem)]">
      <div className="panel flex items-center gap-2.5 h-10 pl-3.5 pr-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
        <span className="tabular-nums">REC {fmt(now - startedAt)}</span>
        {!mic && (
          <span title="No microphone: recording the board only" className="text-zinc-400">
            <MicOff size={15} />
          </span>
        )}
        <button
          onClick={onStop}
          className="h-7 px-2.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 inline-flex items-center gap-1.5"
        >
          <Square size={11} fill="currentColor" /> Stop & save
        </button>
      </div>
    </div>
  );
}
