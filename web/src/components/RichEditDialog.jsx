import { useEffect, useRef, useState } from "react";
import { X, Code2, Sigma, AlertCircle, RefreshCw } from "lucide-react";
import { LANGUAGES } from "../lib/code";
import { renderTex, mathSrc } from "../lib/math";
import { colorFor, INK } from "../lib/render";

const MATH_SNIPPETS = [
  ["a/b", "\\frac{a}{b}"],
  ["√", "\\sqrt{x}"],
  ["xⁿ", "x^{n}"],
  ["xᵢ", "x_{i}"],
  ["Σ", "\\sum_{i=1}^{n} "],
  ["∫", "\\int_{a}^{b} f(x)\\,dx"],
  ["lim", "\\lim_{x \\to \\infty} "],
  ["matrix", "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}"],
  ["cases", "f(x) = \\begin{cases} 1 & x > 0 \\\\ 0 & \\text{otherwise} \\end{cases}"],
  ["α β θ", "\\alpha \\beta \\theta "],
  ["≤ ≠ ≈", "\\le \\ne \\approx "],
  ["→ ⇒", "\\to \\Rightarrow "],
];

const field =
  "w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

/**
 * Editor for code blocks and math equations.
 * kind: "code" | "math"; initial: the element being edited, or defaults for a new one.
 * onSave receives the content fields to merge into the element.
 */
export default function RichEditDialog({ kind, initial, dark, onSave, onCancel }) {
  const isCode = kind === "code";
  const [code, setCode] = useState(initial.code ?? "");
  const [language, setLanguage] = useState(initial.language || "javascript");
  const [theme, setTheme] = useState(initial.theme || "dark");
  const [lineNumbers, setLineNumbers] = useState(initial.lineNumbers !== false);
  const [tex, setTex] = useState(initial.tex ?? "");
  const [math, setMath] = useState(initial.svg ? { tex: initial.tex, svg: initial.svg, ew: initial.ew, eh: initial.eh } : null);
  const [mathError, setMathError] = useState("");
  const [rendering, setRendering] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Live preview: re-render the equation shortly after typing stops
  useEffect(() => {
    if (isCode) return;
    const value = tex.trim();
    if (!value) {
      setMath(null);
      setMathError("");
      return;
    }
    if (math?.tex === value) return;
    let alive = true;
    setRendering(true);
    const t = setTimeout(async () => {
      try {
        const res = await renderTex(value);
        if (!alive) return;
        if (res.error) {
          setMathError(res.error);
          setMath(null);
        } else {
          setMathError("");
          setMath({ tex: value, ...res });
        }
      } catch {
        if (alive) setMathError("Could not load the equation renderer. Check your connection and try again.");
      } finally {
        if (alive) setRendering(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tex, isCode]);

  const canSave = isCode ? code.trim().length > 0 : !!math && math.tex === tex.trim() && !rendering;

  const save = () => {
    if (!canSave) return;
    if (isCode) onSave({ code: code.replace(/\s+$/, ""), language, theme, lineNumbers });
    else onSave({ tex: math.tex, svg: math.svg, ew: math.ew, eh: math.eh });
  };

  const insertSnippet = (snippet) => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.focus();
    ta.setRangeText(snippet, ta.selectionStart, ta.selectionEnd, "end");
    setTex(ta.value);
  };

  const onKeyDown = (e) => {
    // Keep board shortcuts from firing while the dialog is open
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      return onCancel();
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      return save();
    }
    if (isCode && e.key === "Tab" && e.target === inputRef.current) {
      e.preventDefault();
      const ta = e.target;
      ta.setRangeText("    ", ta.selectionStart, ta.selectionEnd, "end");
      setCode(ta.value);
    }
  };

  const Icon = isCode ? Code2 : Sigma;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 backdrop-blur-sm p-4" onPointerDown={onCancel} onKeyDown={onKeyDown}>
      <div
        role="dialog"
        aria-label={isCode ? "Code block" : "Math equation"}
        className="panel !bg-white dark:!bg-zinc-900 w-full max-w-2xl max-h-[90dvh] overflow-y-auto p-5 flex flex-col gap-4 text-zinc-800 dark:text-zinc-100"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 grid place-items-center">
            <Icon size={18} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">{isCode ? "Code block" : "Math equation"}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {isCode ? "Syntax-highlighted and readable from the back of the room" : "Write LaTeX; the preview updates as you type"}
            </p>
          </div>
          <button className="icon-btn" onClick={onCancel} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {isCode ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Language
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className={field}>
                  {LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Theme
                <select value={theme} onChange={(e) => setTheme(e.target.value)} className={field}>
                  <option value="dark">Dark editor</option>
                  <option value="light">Light editor</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm sm:mt-5 cursor-pointer">
                <input type="checkbox" checked={lineNumbers} onChange={(e) => setLineNumbers(e.target.checked)} className="accent-indigo-500 w-4 h-4" />
                Line numbers
              </label>
            </div>
            <textarea
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              rows={12}
              placeholder="Paste or type code…"
              className={`${field} font-mono text-[13px] leading-relaxed resize-y min-h-32`}
              style={{ tabSize: 4, fontVariantLigatures: "none" }}
            />
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-1">
              {MATH_SNIPPETS.map(([label, snippet]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => insertSnippet(snippet)}
                  className="h-8 px-2.5 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  title={snippet}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              ref={inputRef}
              value={tex}
              onChange={(e) => setTex(e.target.value)}
              spellCheck={false}
              rows={4}
              placeholder="e.g. x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}"
              className={`${field} font-mono text-[13px] resize-y`}
            />
            <div className="min-h-28 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 grid place-items-center p-4 overflow-auto">
              {mathError ? (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle size={16} /> {mathError}
                </p>
              ) : math ? (
                <img
                  src={mathSrc(math, colorFor(INK, dark))}
                  alt={math.tex}
                  style={{ width: Math.min(math.ew * 36, 600), height: "auto" }}
                />
              ) : rendering ? (
                <span className="text-sm text-zinc-400 flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin" /> Rendering…
                </span>
              ) : (
                <span className="text-sm text-zinc-400">Preview appears here</span>
              )}
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-xs text-zinc-400 hidden sm:inline">Ctrl+Enter to save · Esc to cancel</span>
          <button
            onClick={onCancel}
            className="h-9 px-4 rounded-xl text-sm font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className="h-9 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
          >
            {initial.id ? "Update" : "Add to board"}
          </button>
        </div>
      </div>
    </div>
  );
}
