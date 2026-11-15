import { useEffect, useRef, useState } from "react";
import {
  Menu,
  FolderOpen,
  Save,
  ImageDown,
  FileCode2,
  Trash2,
  Magnet,
  Sun,
  Moon,
  HelpCircle,
  Expand,
  User,
  LogOut,
  Presentation,
  LayoutTemplate,
  FileText,
  LayoutGrid,
  Timer,
  LockOpen,
} from "lucide-react";

const BGS = [
  { id: "grid", label: "Grid" },
  { id: "dots", label: "Dots" },
  { id: "lines", label: "Ruled" },
  { id: "plain", label: "Plain" },
];

export default function TopMenu({ doc, onAction, user, onOpenAuth, onLogout, cloudStatus }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const Item = ({ icon: Icon, label, hint, action, danger, active, onClick }) => (
    <button
      onClick={() => {
        if (onClick) {
          onClick();
        } else if (onAction) {
          onAction(action);
        }
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
      <button
        className="panel icon-btn !w-11 !h-11 cursor-pointer"
        title="Menu"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Menu size={19} />
      </button>

      {open && (
        <div className="panel absolute left-0 top-13 w-72 max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-var(--ui-top)-4.5rem)] overflow-y-auto overscroll-contain p-1.5 flex flex-col gap-0.5 z-50 shadow-2xl">
          {/* Logo & Workspace Title */}
          <div className="flex items-center gap-2.5 px-3 pt-2 pb-2">
            <img src="/logo.svg" alt="" className="w-8 h-8" />
            <div className="leading-tight">
              <div className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Vairaa Board</div>
              <div className="text-[11px] text-zinc-400">
                {user ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Cloud Synced ({user.name})
                  </span>
                ) : (
                  "Autosaved in this browser"
                )}
              </div>
            </div>
          </div>

          {/* User Account Section */}
          <div className="mx-1 my-1 p-2 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
            {user ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                    {user.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="overflow-hidden leading-tight">
                    <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">
                      {user.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                      {user.company ? `${user.company} • ` : ""}
                      {user.email}
                    </div>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between border-t border-zinc-200/60 dark:border-zinc-700/60">
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    ● Isolated Board Active
                  </span>
                  <button
                    onClick={() => {
                      onLogout();
                      setOpen(false);
                    }}
                    className="flex items-center gap-1 text-[11px] font-medium text-red-500 hover:text-red-600 transition cursor-pointer"
                  >
                    <LogOut size={12} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  onOpenAuth();
                  setOpen(false);
                }}
                className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm shadow-indigo-600/30"
              >
                <User size={14} />
                <span>Sign In / Create Account (OTP)</span>
              </button>
            )}
          </div>

          <div className="h-px bg-zinc-200 dark:bg-zinc-700 mb-1" />
          <div className="px-3 pt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">Teach</div>
          <Item icon={Presentation} label="Present" hint="F5" action="present" />
          <Item icon={FileText} label="Import slides (PDF)…" action="pdf" />
          <Item icon={LayoutTemplate} label="Teaching templates…" action="templates" />
          <Item icon={LayoutGrid} label="All pages" hint="G" action="overview" />
          <Item icon={Timer} label="Class timer" action="timer" />
          <Item icon={LockOpen} label="Unlock items on this page" action="unlock" />

          <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
          <Item icon={FolderOpen} label="Import board (.json)…" hint="Ctrl+O" action="open" />
          <Item icon={Save} label="Save board (.json)" hint="Ctrl+S" action="save" />
          <Item icon={ImageDown} label="Export PNG" hint="Ctrl+E" action="png" />
          <Item icon={FileCode2} label="Export SVG" action="svg" />

          <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
          <div className="px-3 pt-1 pb-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 mb-1.5">
              Background
            </div>
            <div className="grid grid-cols-4 gap-1">
              {BGS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => onAction("bg:" + b.id)}
                  className={`h-8 rounded-lg text-xs font-medium transition cursor-pointer ${
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
