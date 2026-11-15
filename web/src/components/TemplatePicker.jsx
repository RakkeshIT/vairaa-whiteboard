import { useMemo } from "react";
import { X, LayoutTemplate } from "lucide-react";
import TEMPLATES from "../lib/templates";
import { thumbnail } from "./PageOverview";

export default function TemplatePicker({ dark, onPick, onClose }) {
  const items = useMemo(
    () => TEMPLATES.map((t) => ({ ...t, thumb: thumbnail(t.build(), dark) })),
    [dark],
  );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 backdrop-blur-sm p-4"
      onPointerDown={onClose}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Templates"
        className="panel !bg-white dark:!bg-zinc-900 w-full max-w-4xl max-h-[88dvh] overflow-y-auto p-5 text-zinc-800 dark:text-zinc-100"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 grid place-items-center">
            <LayoutTemplate size={18} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">Teaching templates</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Everything stays editable. Added on a new page if this one already has content.
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close" autoFocus>
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {items.map((t) => (
            <button
              key={t.id}
              onClick={() => onPick(t)}
              className="group text-left rounded-xl ring-1 ring-zinc-200 dark:ring-zinc-700 hover:ring-2 hover:ring-indigo-500 overflow-hidden transition"
            >
              <div className="aspect-[4/3] bg-zinc-50 dark:bg-zinc-800 grid place-items-center p-2">
                {t.thumb && <img src={t.thumb} alt="" className="max-w-full max-h-full object-contain" />}
              </div>
              <div className="p-2.5">
                <div className="text-sm font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{t.name}</div>
                <div className="hidden sm:block text-xs text-zinc-500 dark:text-zinc-400 leading-snug mt-0.5">{t.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
