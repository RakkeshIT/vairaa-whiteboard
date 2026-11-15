import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  MousePointer2,
  Hand,
  Pencil,
  Highlighter,
  Eraser,
  Zap,
  Slash,
  MoveUpRight,
  Square,
  Circle,
  Diamond,
  Type,
  StickyNote,
  ImagePlus,
  Smile,
  Code2,
  Sigma,
  LayoutTemplate,
  MoreHorizontal,
} from "lucide-react";

// `rank`: lower stays on the bar longer when space is short; the rest move into "More".
export const TOOLS = [
  { id: "select", icon: MousePointer2, label: "Select", key: "V", rank: 0 },
  { id: "hand", icon: Hand, label: "Hand / pan", key: "H", rank: 3 },
  "|",
  { id: "pen", icon: Pencil, label: "Pen", key: "P", rank: 1 },
  { id: "hl", icon: Highlighter, label: "Highlighter", key: "M", rank: 4 },
  { id: "eraser", icon: Eraser, label: "Eraser", key: "E", rank: 2 },
  { id: "laser", icon: Zap, label: "Laser pointer", key: "K", rank: 5 },
  "|",
  { id: "line", icon: Slash, label: "Line", key: "L", rank: 13 },
  { id: "arrow", icon: MoveUpRight, label: "Arrow", key: "A", rank: 7 },
  { id: "rect", icon: Square, label: "Rectangle", key: "R", rank: 8 },
  { id: "ellipse", icon: Circle, label: "Ellipse", key: "O", rank: 14 },
  { id: "diamond", icon: Diamond, label: "Diamond", key: "D", rank: 15 },
  "|",
  { id: "text", icon: Type, label: "Text", key: "T", rank: 6 },
  { id: "sticky", icon: StickyNote, label: "Sticky note", key: "N", rank: 9 },
  { id: "stamp", icon: Smile, label: "Emoji, avatars & points", key: "S", rank: 16 },
  { id: "image", icon: ImagePlus, label: "Insert image", key: "I", rank: 17 },
  "|",
  { id: "code", icon: Code2, label: "Code block", key: "B", rank: 10 },
  { id: "math", icon: Sigma, label: "Math equation", key: "Q", rank: 11 },
  { id: "template", icon: LayoutTemplate, label: "Teaching templates", rank: 12 },
];

const ITEMS = TOOLS.filter((t) => t !== "|");
const BTN = 38; // icon button (36px) + gap
const SEP = 9; // separator (1px + margins)
const PAD = 14; // panel padding + border

/** Toolbar width when the `n` highest-priority tools are shown (plus a More button if any are hidden). */
function widthFor(n) {
  const shown = new Set([...ITEMS].sort((a, b) => a.rank - b.rank).slice(0, n).map((t) => t.id));
  let w = PAD + n * BTN;
  let seps = 0;
  let groupHasItem = false;
  for (const t of TOOLS) {
    if (t === "|") {
      if (groupHasItem) seps++;
      groupHasItem = false;
    } else if (shown.has(t.id)) groupHasItem = true;
  }
  if (!groupHasItem) seps--; // no separator after the last visible group
  w += Math.max(0, seps) * SEP;
  if (n < ITEMS.length) w += BTN + SEP;
  return { w, shown };
}

const Btn = ({ t, tool, onTool }) => (
  <button
    data-tool={t.id}
    title={t.key ? `${t.label} (${t.key})` : t.label}
    aria-label={t.label}
    aria-pressed={tool === t.id}
    onClick={() => onTool(t.id)}
    className={`icon-btn relative ${tool === t.id ? "on" : ""}`}
  >
    <t.icon size={18} strokeWidth={tool === t.id ? 2.4 : 2} />
    {t.key && <span className="hidden lg:block absolute bottom-0.5 right-1 text-[8px] leading-none opacity-40">{t.key}</span>}
  </button>
);

export default function Toolbar({ tool, onTool }) {
  const wrapRef = useRef(null);
  const moreRef = useRef(null);
  const [shown, setShown] = useState(() => new Set(ITEMS.map((t) => t.id)));
  const [moreOpen, setMoreOpen] = useState(false);

  // Fit as many tools as the available width allows; the rest go into "More"
  useLayoutEffect(() => {
    const el = wrapRef.current;
    const fit = () => {
      const avail = el.clientWidth;
      let n = ITEMS.length;
      while (n > 4 && widthFor(n).w > avail) n--;
      setShown(widthFor(n).shown);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e) => !moreRef.current?.contains(e.target) && setMoreOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [moreOpen]);

  const hidden = ITEMS.filter((t) => !shown.has(t.id));
  const activeHidden = hidden.find((t) => t.id === tool);

  // Visible tools in display order, with separators only between non-empty groups
  const row = [];
  let pendingSep = false;
  for (const t of TOOLS) {
    if (t === "|") pendingSep = row.length > 0;
    else if (shown.has(t.id)) {
      if (pendingSep) row.push("|");
      pendingSep = false;
      row.push(t);
    }
  }

  return (
    <div ref={wrapRef} className="w-full min-w-0 flex justify-center pointer-events-none">
      <div className="panel pointer-events-auto flex items-center gap-0.5 p-1.5 max-w-full">
        {row.map((t, i) =>
          t === "|" ? (
            <div key={`sep${i}`} className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1 shrink-0" />
          ) : (
            <Btn key={t.id} t={t} tool={tool} onTool={onTool} />
          ),
        )}
        {hidden.length > 0 && (
          <div ref={moreRef} className="relative flex items-center">
            <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1 shrink-0" />
            <button
              className={`icon-btn ${activeHidden || moreOpen ? "on" : ""}`}
              title={activeHidden ? `${activeHidden.label} · more tools` : "More tools"}
              aria-label="More tools"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((o) => !o)}
            >
              {activeHidden ? <activeHidden.icon size={18} strokeWidth={2.4} /> : <MoreHorizontal size={18} />}
            </button>
            {moreOpen && (
              <div className="panel absolute right-0 top-full mt-2 z-50 p-1.5 w-[min(16rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-var(--ui-top)-var(--header-h)-1rem)] overflow-y-auto overscroll-contain grid grid-cols-1 gap-0.5 shadow-2xl">
                {hidden.map((t) => (
                  <button
                    key={t.id}
                    data-tool={t.id}
                    onClick={() => {
                      onTool(t.id);
                      setMoreOpen(false);
                    }}
                    className={`flex items-center gap-2.5 h-10 px-2.5 rounded-xl text-sm text-left transition ${
                      tool === t.id
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-200"
                        : "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <t.icon size={17} />
                    <span className="flex-1">{t.label}</span>
                    {t.key && <kbd className="text-[10px] font-mono text-zinc-400">{t.key}</kbd>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
