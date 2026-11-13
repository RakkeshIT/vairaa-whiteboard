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
} from "lucide-react";

export const TOOLS = [
  { id: "select", icon: MousePointer2, label: "Select", key: "V" },
  { id: "hand", icon: Hand, label: "Hand / pan", key: "H" },
  "|",
  { id: "pen", icon: Pencil, label: "Pen", key: "P" },
  { id: "hl", icon: Highlighter, label: "Highlighter", key: "M" },
  { id: "eraser", icon: Eraser, label: "Eraser", key: "E" },
  { id: "laser", icon: Zap, label: "Laser pointer", key: "K" },
  "|",
  { id: "line", icon: Slash, label: "Line", key: "L" },
  { id: "arrow", icon: MoveUpRight, label: "Arrow", key: "A" },
  { id: "rect", icon: Square, label: "Rectangle", key: "R" },
  { id: "ellipse", icon: Circle, label: "Ellipse", key: "O" },
  { id: "diamond", icon: Diamond, label: "Diamond", key: "D" },
  "|",
  { id: "text", icon: Type, label: "Text", key: "T" },
  { id: "sticky", icon: StickyNote, label: "Sticky note", key: "N" },
  { id: "stamp", icon: Smile, label: "Emoji, avatars & points", key: "S" },
  { id: "image", icon: ImagePlus, label: "Insert image", key: "I" },
];

export default function Toolbar({ tool, onTool }) {
  return (
    <div className="panel flex items-center gap-0.5 p-1.5 overflow-x-auto no-scrollbar max-w-[calc(100vw-120px)] lg:max-w-none">
      {TOOLS.map((t, i) =>
        t === "|" ? (
          <div key={i} className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1 shrink-0" />
        ) : (
          <button
            key={t.id}
            data-tool={t.id}
            title={`${t.label} (${t.key})`}
            aria-label={t.label}
            aria-pressed={tool === t.id}
            onClick={() => onTool(t.id)}
            className={`icon-btn relative ${tool === t.id ? "on" : ""}`}
          >
            <t.icon size={18} strokeWidth={tool === t.id ? 2.4 : 2} />
            <span className="hidden lg:block absolute bottom-0.5 right-1 text-[8px] leading-none opacity-40">{t.key}</span>
          </button>
        ),
      )}
    </div>
  );
}
