import { useMemo } from "react";
import { X, Plus, LayoutGrid } from "lucide-react";
import { renderToCanvas } from "../lib/render";
import { unionBounds } from "../lib/elements";

const THUMB_W = 360;

/** Small PNG data URL of some elements (null when empty). */
export function thumbnail(els, dark) {
  const b = unionBounds(els);
  if (!b) return null;
  const pad = 24;
  const scale = Math.min(1, THUMB_W / (b.w + pad * 2));
  return renderToCanvas(els, { dark, scale, pad })?.toDataURL("image/png") ?? null;
}

export default function PageOverview({ pages, current, dark, onSelect, onAdd, onClose }) {
  const thumbs = useMemo(() => pages.map((p) => thumbnail(p.elements, dark)), [pages, dark]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      onPointerDown={onClose}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="All pages"
        className="panel !bg-white dark:!bg-zinc-900 w-full max-w-5xl mx-auto my-2 sm:my-8 p-4 sm:p-5 text-zinc-800 dark:text-zinc-100"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 mb-4">
          <LayoutGrid size={18} className="text-indigo-500" />
          <h2 className="flex-1 text-base font-semibold">
            All pages <span className="text-zinc-400 font-normal">· {pages.length}</span>
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close" autoFocus>
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {pages.map((p, i) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`text-left rounded-xl overflow-hidden transition ${
                p.id === current ? "ring-2 ring-indigo-500" : "ring-1 ring-zinc-200 dark:ring-zinc-700 hover:ring-2 hover:ring-indigo-300"
              }`}
            >
              <div className={`aspect-video grid place-items-center p-1.5 ${dark ? "bg-[#16181d]" : "bg-white"}`}>
                {thumbs[i] ? (
                  <img src={thumbs[i]} alt="" className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="text-xs text-zinc-400">Empty</span>
                )}
              </div>
              <div className="px-2.5 py-1.5 text-xs font-medium flex gap-1.5 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-400 tabular-nums">{i + 1}</span>
                <span className="truncate">{p.name}</span>
              </div>
            </button>
          ))}
          <button
            onClick={onAdd}
            className="aspect-video rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-indigo-600 hover:border-indigo-400 grid place-items-center text-sm font-medium"
          >
            <span className="flex items-center gap-1.5">
              <Plus size={16} /> New page
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
