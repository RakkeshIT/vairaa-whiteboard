import { useEffect, useState } from "react";
import { X, Radio, Copy, Check, RefreshCw } from "lucide-react";
import { whiteboardApi } from "../lib/api";

export const liveLink = (code) => `${window.location.origin}/?live=${code}`;

/** Start / show / stop the read-only live view students open in their browser. */
export default function ShareDialog({ user, boardId, code, onCode, onSignIn, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await whiteboardApi.share(boardId);
      onCode(res.code);
    } catch (err) {
      setError(err.message || "Could not start the live view");
    } finally {
      setBusy(false);
    }
  };
  const stop = async () => {
    setBusy(true);
    setError("");
    try {
      await whiteboardApi.unshare(boardId);
      onCode(null);
    } catch (err) {
      setError(err.message || "Could not stop the live view");
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(liveLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy failed: select the link and copy it manually");
    }
  };

  // Opening the dialog while signed in starts sharing straight away
  useEffect(() => {
    if (user && !code) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/40 backdrop-blur-sm p-4"
      onPointerDown={onClose}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Live view"
        className="panel !bg-white dark:!bg-zinc-900 w-full max-w-md p-5 flex flex-col gap-4 text-zinc-800 dark:text-zinc-100"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 grid place-items-center">
            <Radio size={18} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">Live view for students</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">They follow your current page, read-only, with no account</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {!user ? (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Live view uses cloud sync, so sign in first. Your board is saved to your account and students see it update as you teach.
            </p>
            <button onClick={onSignIn} className="h-10 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500">
              Sign in to share
            </button>
          </>
        ) : code ? (
          <>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={liveLink(code)}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/70 px-3 h-10 text-sm font-mono"
              />
              <button onClick={copy} className="h-10 px-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 inline-flex items-center gap-1.5">
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <ul className="text-xs text-zinc-500 dark:text-zinc-400 list-disc pl-4 space-y-1">
              <li>Students see each stroke about a second after you lift the pen.</li>
              <li>They follow the page you're on; hidden answers stay covered until you reveal them.</li>
              <li>Anyone with the link can watch. Stop sharing to turn the link off.</li>
            </ul>
            <button
              onClick={stop}
              disabled={busy}
              className="h-10 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/60 disabled:opacity-50"
            >
              Stop sharing
            </button>
          </>
        ) : (
          <div className="h-20 grid place-items-center text-sm text-zinc-500">
            {busy ? (
              <span className="flex items-center gap-2">
                <RefreshCw size={14} className="animate-spin" /> Starting live view…
              </span>
            ) : (
              <button onClick={start} className="h-10 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500">
                Start live view
              </button>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
