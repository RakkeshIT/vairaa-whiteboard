import { ChevronLeft, ChevronRight, Pencil, Highlighter, Zap, Eraser, MousePointer2, Focus, Timer, Brush, X, Hand, Video } from "lucide-react";
import { INK } from "../lib/render";

const TOOLS = [
  ["select", MousePointer2, "Select (V)"],
  ["hand", Hand, "Pan (H)"],
  ["pen", Pencil, "Pen (P)"],
  ["hl", Highlighter, "Highlighter (M)"],
  ["laser", Zap, "Laser pointer (K)"],
  ["eraser", Eraser, "Eraser (E)"],
];
const COLORS = [INK, "#e03131", "#1971c2", "#2f9e44", "#f08c00"];

/** Floating controls shown while presenting. */
export default function PresenterBar({
  pageIndex,
  pageCount,
  onPrev,
  onNext,
  onOverview,
  tool,
  onTool,
  color,
  onColor,
  dark,
  spotlight,
  onSpotlight,
  timerOpen,
  onTimer,
  annotationCount,
  onClearAnnotations,
  recording,
  onRecord,
  onExit,
}) {
  return (
    <div className="panel flex flex-wrap sm:flex-nowrap items-center justify-center gap-0.5 p-1.5 max-w-full">
      <button className="icon-btn" onClick={onPrev} disabled={pageIndex === 0} title="Previous page (← / PageUp)">
        <ChevronLeft size={18} />
      </button>
      <button
        className="h-9 px-2.5 rounded-xl text-sm font-semibold tabular-nums hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 shrink-0"
        onClick={onOverview}
        title="All pages (G)"
      >
        {pageIndex + 1} / {pageCount}
      </button>
      <button className="icon-btn" onClick={onNext} disabled={pageIndex >= pageCount - 1} title="Next page (→ / PageDown)">
        <ChevronRight size={18} />
      </button>

      <div className="hidden sm:block w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1 shrink-0" />
      {TOOLS.map(([id, Icon, label]) => (
        <button key={id} className={`icon-btn ${tool === id ? "on" : ""}`} onClick={() => onTool(id)} title={label} aria-pressed={tool === id}>
          <Icon size={17} />
        </button>
      ))}

      <div className="hidden sm:block w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1 shrink-0" />
      {COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onColor(c)}
          title={c === INK ? "Ink" : c}
          className={`w-6 h-6 mx-0.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/20 transition hover:scale-110 ${
            color === c ? "outline-2 outline-offset-2 outline-indigo-500" : ""
          }`}
          style={{ background: c === INK && dark ? "#e9e9ee" : c }}
        />
      ))}

      <div className="hidden sm:block w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1 shrink-0" />
      <button className={`icon-btn ${spotlight ? "on" : ""}`} onClick={onSpotlight} title="Spotlight: dim everything except around the pointer" aria-pressed={spotlight}>
        <Focus size={17} />
      </button>
      <button
        className={`icon-btn ${recording ? "!text-red-500 !bg-red-50 dark:!bg-red-950/40" : ""}`}
        onClick={onRecord}
        title={recording ? "Stop recording and save the video" : "Record the lesson (board + microphone)"}
        aria-pressed={!!recording}
      >
        <Video size={17} />
      </button>
      <button className={`icon-btn ${timerOpen ? "on" : ""}`} onClick={onTimer} title="Class timer" aria-pressed={timerOpen}>
        <Timer size={17} />
      </button>
      <button
        className="icon-btn relative"
        onClick={onClearAnnotations}
        disabled={!annotationCount}
        title="Clear ink drawn while presenting on this page"
        aria-label={`Clear ${annotationCount} annotation${annotationCount === 1 ? "" : "s"} on this page`}
      >
        <Brush size={17} />
        {annotationCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-indigo-500 text-white text-[9px] font-bold grid place-items-center">
            {annotationCount > 99 ? "99+" : annotationCount}
          </span>
        )}
      </button>

      <div className="hidden sm:block w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1 shrink-0" />
      <button className="icon-btn !text-red-500" onClick={onExit} title="End presentation (Esc)">
        <X size={18} />
      </button>
    </div>
  );
}
