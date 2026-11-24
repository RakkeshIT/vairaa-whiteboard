import { X } from "lucide-react";
import { TOOLS } from "./Toolbar";

const SHORTCUTS = [
  ["Undo / Redo", "Ctrl Z  ·  Ctrl Y / Ctrl Shift Z"],
  ["Copy / Cut / Paste", "Ctrl C  ·  Ctrl X  ·  Ctrl V"],
  ["Duplicate", "Ctrl D  (or Alt + drag)"],
  ["Select all", "Ctrl A"],
  ["Delete selection", "Delete / Backspace"],
  ["Nudge", "Arrow keys (Shift = 10px)"],
  ["Layer forward / back", "Ctrl ]  ·  Ctrl ["],
  ["Pan", "Space + drag · middle mouse · scroll"],
  ["Zoom", "Ctrl + scroll · pinch · Ctrl + / −"],
  ["Zoom to fit / 100%", "Shift 1  ·  Ctrl 0"],
  ["Straight lines / squares", "Hold Shift while drawing"],
  ["Keep aspect ratio", "Hold Shift while resizing"],
  ["Edit text / note", "Double-click it"],
  ["Bold / Italic / Underline", "Ctrl B  ·  Ctrl I  ·  Ctrl U"],
  ["Bullet / numbered points", "Ctrl Shift 8  ·  Ctrl Shift 7"],
  ["Next point", "Enter (Enter on an empty point ends the list)"],
  ["Emoji while drawing", "Pen panel → Quick stamps (returns to pen)"],
  ["New text anywhere", "Double-click empty canvas"],
  ["Paste image", "Ctrl V, or drop a file on the board"],
  ["Save / Open / PNG", "Ctrl S  ·  Ctrl O  ·  Ctrl E"],
  ["Fullscreen", "F"],
  ["Present / end presentation", "F5  ·  Esc"],
  ["Next / previous page (presenting)", "→ ↓ PageDown  ·  ← ↑ PageUp"],
  ["All pages", "G"],
  ["Edit code block / equation", "Double-click it"],
  ["Import slides", "Menu → Import slides (PDF), or drop a PDF"],
  ["Cycle pointer style", ". (plus · dot · ring · pencil · arrow)"],
  ["Quick shape", "Draw a line / box / circle, then hold the pen still"],
  ["Straight line with the ruler", "Toolbar → Ruler, draw along its edge"],
  ["Rotate ruler / protractor", "Drag the round knob (snaps to 15°)"],
  ["Compass", "J · drag from the centre for the radius, then drag around"],
  ["Reveal a hidden answer", "Tap it while presenting · double-click otherwise"],
  ["Rub out part of a stroke", "Eraser → Partial"],
  ["Share live with students", "Menu → Share live view"],
  ["Record the lesson / PDF handout", "Menu → Record lesson · Export lesson as PDF"],
];

export default function HelpModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 backdrop-blur-sm p-4" onPointerDown={onClose}>
      <div
        className="panel !bg-white dark:!bg-zinc-900 w-full max-w-2xl max-h-[85dvh] overflow-y-auto p-6 text-zinc-700 dark:text-zinc-200"
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Keyboard shortcuts"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Tools</h3>
            {TOOLS.filter((t) => t !== "|" && t.key).map((t) => (
              <div key={t.id} className="flex items-center gap-2 py-1 text-sm">
                <t.icon size={15} className="opacity-70" />
                <span className="flex-1">{t.label}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-xs font-mono">{t.key}</kbd>
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Actions</h3>
            {SHORTCUTS.map(([a, k]) => (
              <div key={a} className="flex justify-between gap-3 py-1 text-sm">
                <span>{a}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 text-right">{k}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
