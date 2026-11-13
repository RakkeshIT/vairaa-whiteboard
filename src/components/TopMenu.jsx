import { useEffect, useRef, useState } from "react";
import { Menu, FolderOpen, Save, ImageDown, FileCode2, Trash2, Magnet, Sun, Moon, HelpCircle, Expand } from "lucide-react";

const BGS = [
  { id: "grid", label: "Grid" },
  { id: "dots", label: "Dots" },
  { id: "lines", label: "Ruled" },
  { id: "plain", label: "Plain" },
];

export default function TopMenu({ doc, onAction }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const Item = ({ icon: Icon, label, hint, action, danger, active }) => (
    <button
      onClick={() => {
        onAction(action);
        if (!["snap", "theme"].includes(action)) setOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
        danger ? "text-red-500" : "text-zinc-700 dark:text-zinc-200"
      }`}
    >
      <Icon size={16} className="shrink-0 opacity-80" />
      <span className="flex-1">{label}</span>
      {active !== undefined && (
        <span className={`w-7 h-4 rounded-full p-0.5 transition ${active ? "bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-600"}`}>
          <span className={`block w-3 h-3 rounded-full bg-white transition ${active ? "translate-x-3" : ""}`} />
        </span>
      )}
      {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button className="panel icon-btn !w-11 !h-11" title="Menu" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Menu size={19} />
      </button>
      {open && (
        <div className="panel absolute left-0 top-13 w-64 p-1.5 flex flex-col gap-0.5 z-50">
          <div className="flex items-center gap-2.5 px-3 pt-2 pb-2.5">
            <img src="/logo.svg" alt="" className="w-8 h-8" />
            <div className="leading-tight">
              <div className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Vairaa Board</div>
              <div className="text-[11px] text-zinc-400">Autosaved in this browser</div>
            </div>
          </div>
          <div className="h-px bg-zinc-200 dark:bg-zinc-700 mb-1" />
          <Item icon={FolderOpen} label="Import board (.json)…" hint="Ctrl+O" action="open" />
          <Item icon={Save} label="Save board (.json)" hint="Ctrl+S" action="save" />
          <Item icon={ImageDown} label="Export PNG" hint="Ctrl+E" action="png" />
          <Item icon={FileCode2} label="Export SVG" action="svg" />
          <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
          <div className="px-3 pt-1 pb-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 mb-1.5">Background</div>
            <div className="grid grid-cols-4 gap-1">
              {BGS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => onAction("bg:" + b.id)}
                  className={`h-8 rounded-lg text-xs font-medium transition ${
                    doc.bg === b.id
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-200"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <Item icon={doc.dark ? Sun : Moon} label="Dark board" action="theme" active={doc.dark} />
          <Item icon={Magnet} label="Snap to grid" action="snap" active={doc.snap} />
          <Item icon={Expand} label="Fullscreen" hint="F" action="fullscreen" />
          <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
          <Item icon={HelpCircle} label="Keyboard shortcuts" hint="?" action="help" />
          <Item icon={Trash2} label="Clear page" action="clear" danger />
        </div>
      )}
    </div>
  );
}
