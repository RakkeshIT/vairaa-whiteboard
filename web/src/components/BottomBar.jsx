import { useState } from "react";
import { Undo2, Redo2, ZoomIn, ZoomOut, Scan, Plus, X, LayoutGrid } from "lucide-react";

export function ZoomControls({ zoom, onZoom, onUndo, onRedo, canUndo, canRedo }) {
  return (
    <div className="flex gap-2">
      <div className="panel flex items-center p-1">
        <button className="icon-btn" title="Zoom out (Ctrl -)" onClick={() => onZoom("out")}>
          <ZoomOut size={17} />
        </button>
        <button
          className="h-9 min-w-14 px-1 rounded-xl text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title="Reset zoom (Ctrl 0)"
          onClick={() => onZoom("reset")}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button className="icon-btn" title="Zoom in (Ctrl +)" onClick={() => onZoom("in")}>
          <ZoomIn size={17} />
        </button>
        <button className="icon-btn" title="Zoom to fit (Shift 1)" onClick={() => onZoom("fit")}>
          <Scan size={17} />
        </button>
      </div>
      <div className="panel flex items-center p-1">
        <button className="icon-btn" title="Undo (Ctrl Z)" disabled={!canUndo} onClick={onUndo}>
          <Undo2 size={17} />
        </button>
        <button className="icon-btn" title="Redo (Ctrl Y)" disabled={!canRedo} onClick={onRedo}>
          <Redo2 size={17} />
        </button>
      </div>
    </div>
  );
}

export function PageTabs({ pages, current, onSelect, onAdd, onRename, onDelete, onOverview }) {
  const [editing, setEditing] = useState(null);
  return (
    <div className="panel flex items-center gap-0.5 p-1 max-w-full lg:max-w-[46vw] overflow-x-auto no-scrollbar">
      <button className="icon-btn" title="All pages (G)" onClick={onOverview}>
        <LayoutGrid size={16} />
      </button>
      {pages.map((p) => (
        <div
          key={p.id}
          className={`group flex items-center h-9 rounded-xl shrink-0 transition ${
            p.id === current
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-200"
              : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          {editing === p.id ? (
            <input
              autoFocus
              defaultValue={p.name}
              maxLength={40}
              className="w-24 bg-transparent px-3 text-sm outline-none"
              onBlur={(e) => {
                onRename(p.id, e.target.value.trim() || p.name);
                setEditing(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditing(null);
                e.stopPropagation();
              }}
            />
          ) : (
            <button
              className="px-3 h-full text-sm font-medium whitespace-nowrap"
              onClick={() => onSelect(p.id)}
              onDoubleClick={() => setEditing(p.id)}
              title="Double-click to rename"
            >
              {p.name}
            </button>
          )}
          {pages.length > 1 && p.id === current && editing !== p.id && (
            <button className="mr-1 w-6 h-6 rounded-lg grid place-items-center hover:bg-black/10 dark:hover:bg-white/10" title="Delete page" onClick={() => onDelete(p.id)}>
              <X size={13} />
            </button>
          )}
        </div>
      ))}
      <button className="icon-btn" title="New page" onClick={onAdd}>
        <Plus size={17} />
      </button>
    </div>
  );
}
