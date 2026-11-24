import { useEffect, useRef, useState } from "react";
import { X, ChartSpline, Plus, Trash2, AlertCircle } from "lucide-react";
import { compile } from "../lib/expr";
import { drawGraph, GRAPH_COLORS, GRAPH_DEFAULTS } from "../lib/graph";

const field =
  "w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const EXAMPLES = ["x^2 - 4", "sin(x)", "2x + 1", "1/x", "sqrt(x)", "|x| - 3", "e^(-x^2)", "tan x"];
const MAX_FNS = 5;
const PREVIEW = { w: 560, h: 340 };

const errorOf = (expr) => {
  try {
    compile(expr);
    return "";
  } catch (e) {
    return e.message;
  }
};

/** Editor for graph elements. onSave receives { fns, xMin, xMax, yMin, yMax }. */
export default function GraphDialog({ initial, dark, onSave, onCancel }) {
  const [fns, setFns] = useState(() => (initial.fns?.length ? initial.fns : [{ expr: "x^2 - 4", color: GRAPH_COLORS[0] }]));
  const [range, setRange] = useState(() => ({
    xMin: initial.xMin ?? GRAPH_DEFAULTS.xMin,
    xMax: initial.xMax ?? GRAPH_DEFAULTS.xMax,
    yMin: initial.yMin ?? GRAPH_DEFAULTS.yMin,
    yMax: initial.yMax ?? GRAPH_DEFAULTS.yMax,
  }));
  const canvasRef = useRef(null);
  const firstInput = useRef(null);

  const errors = fns.map((f) => errorOf(f.expr));
  const nums = Object.fromEntries(Object.entries(range).map(([k, v]) => [k, parseFloat(v)]));
  const rangeOk = nums.xMax > nums.xMin && nums.yMax > nums.yMin;
  const canSave = rangeOk && fns.length > 0 && errors.every((e) => !e);

  useEffect(() => firstInput.current?.focus(), []);

  // live preview (invalid functions are simply skipped)
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = PREVIEW.w * dpr;
    cv.height = PREVIEW.h * dpr;
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, PREVIEW.w, PREVIEW.h);
    if (rangeOk) drawGraph(ctx, { fns, ...nums, strokeWidth: 3 }, { x: 0, y: 0, ...PREVIEW }, { dark });
  });

  const setFn = (i, patch) => setFns((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const addFn = () =>
    setFns((fs) => (fs.length >= MAX_FNS ? fs : [...fs, { expr: "", color: GRAPH_COLORS[fs.length % GRAPH_COLORS.length] }]));
  const save = () => canSave && onSave({ fns: fns.map((f) => ({ expr: f.expr.trim(), color: f.color })), ...nums });

  const onKeyDown = (e) => {
    e.stopPropagation(); // keep board shortcuts from firing while typing
    if (e.key === "Escape") return (e.preventDefault(), onCancel());
    if (e.key === "Enter") return (e.preventDefault(), save());
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 backdrop-blur-sm p-4" onPointerDown={onCancel} onKeyDown={onKeyDown}>
      <div
        role="dialog"
        aria-label="Graph"
        className="panel !bg-white dark:!bg-zinc-900 w-full max-w-2xl max-h-[92dvh] overflow-y-auto p-5 flex flex-col gap-4 text-zinc-800 dark:text-zinc-100"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 grid place-items-center">
            <ChartSpline size={18} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">Graph</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Plot up to {MAX_FNS} functions of x, e.g. 2x + 1, sin(x), x^2</p>
          </div>
          <button className="icon-btn" onClick={onCancel} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {fns.map((f, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <label className="relative w-8 h-8 shrink-0 rounded-lg overflow-hidden ring-1 ring-black/10 dark:ring-white/15 cursor-pointer" style={{ background: f.color }} title="Line colour">
                  <input type="color" value={f.color} onChange={(e) => setFn(i, { color: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
                </label>
                <span className="text-sm font-semibold text-zinc-500 shrink-0">y =</span>
                <input
                  ref={i === 0 ? firstInput : undefined}
                  value={f.expr}
                  onChange={(e) => setFn(i, { expr: e.target.value })}
                  spellCheck={false}
                  placeholder="x^2 - 4"
                  aria-invalid={!!errors[i]}
                  className={`${field} font-mono ${errors[i] && f.expr ? "!border-red-400" : ""}`}
                />
                <button className="icon-btn !text-zinc-400 hover:!text-red-500" disabled={fns.length < 2} onClick={() => setFns((fs) => fs.filter((_, j) => j !== i))} title="Remove" aria-label="Remove function">
                  <Trash2 size={16} />
                </button>
              </div>
              {errors[i] && f.expr && (
                <p role="alert" className="ml-[4.5rem] text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors[i]}
                </p>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={addFn}
              disabled={fns.length >= MAX_FNS}
              className="h-8 px-2.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 inline-flex items-center gap-1 disabled:opacity-40"
            >
              <Plus size={14} /> Add function
            </button>
            <span className="text-xs text-zinc-400 ml-2">Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setFn(fns.length - 1, { expr: ex })}
                className="h-7 px-2 rounded-lg text-xs font-mono bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ["xMin", "x from"],
            ["xMax", "x to"],
            ["yMin", "y from"],
            ["yMax", "y to"],
          ].map(([k, label]) => (
            <label key={k} className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {label}
              <input type="number" value={range[k]} onChange={(e) => setRange((r) => ({ ...r, [k]: e.target.value }))} className={field} />
            </label>
          ))}
        </div>
        {!rangeOk && <p className="text-xs text-red-600 dark:text-red-400 -mt-2">Each range's "to" must be bigger than its "from".</p>}

        <canvas ref={canvasRef} className="w-full h-auto rounded-xl" style={{ aspectRatio: `${PREVIEW.w} / ${PREVIEW.h}` }} />

        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-xs text-zinc-400 hidden sm:inline">Enter to save · Esc to cancel</span>
          <button onClick={onCancel} className="h-9 px-4 rounded-xl text-sm font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">
            Cancel
          </button>
          <button onClick={save} disabled={!canSave} className="h-9 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50">
            {initial.id ? "Update" : "Add to board"}
          </button>
        </div>
      </div>
    </div>
  );
}
