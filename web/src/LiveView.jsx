import { useEffect, useRef, useState } from "react";
import { Radio, Maximize, WifiOff } from "lucide-react";
import { liveApi } from "./lib/api";
import * as G from "./lib/elements";
import { drawElement, drawBackground, setAssetListener } from "./lib/render";

const POLL_MS = 1000;
const clampZ = (z) => Math.min(8, Math.max(0.1, z));

/** Read-only student view of a teacher's board: follows their current page, updated by polling. */
export default function LiveView({ code }) {
  const canvasRef = useRef(null);
  const board = useRef({ elements: [], bg: "grid", dark: false, pageId: null });
  const cam = useRef({ x: 0, y: 0, z: 1 });
  const follow = useRef(true); // keep fitting new content until the student pans or zooms
  const drag = useRef(null);
  const dirty = useRef(true);
  const [status, setStatus] = useState("connecting"); // connecting | live | offline | ended
  const [info, setInfo] = useState({ title: "", page: "", index: 0, count: 0 });

  const fit = () => {
    const els = board.current.elements;
    const b = G.unionBounds(els);
    const W = window.innerWidth,
      H = window.innerHeight;
    if (!b) cam.current = { x: W / 2, y: H / 2, z: 1 };
    else {
      const z = clampZ(Math.min((W - 48) / Math.max(b.w, 1), (H - 120) / Math.max(b.h, 1), 2));
      cam.current = { z, x: W / 2 - (b.x + b.w / 2) * z, y: H / 2 - (b.y + b.h / 2) * z };
    }
    dirty.current = true;
  };

  // polling
  useEffect(() => {
    let alive = true,
      timer = null,
      since = null;
    const tick = async () => {
      if (!alive) return;
      if (document.visibilityState === "hidden") {
        timer = setTimeout(tick, POLL_MS * 3);
        return;
      }
      try {
        const res = await liveApi.get(code, since);
        if (!alive) return;
        if (!res.unchanged) {
          since = res.updatedAt;
          const pageChanged = res.page.id !== board.current.pageId;
          board.current = {
            pageId: res.page.id,
            bg: res.bg || "grid",
            dark: !!res.dark,
            elements: res.page.elements.map((el) =>
              el.asset ? { ...el, src: liveApi.assetUrl(code, res.page.id, el.asset) } : el,
            ),
          };
          document.documentElement.classList.toggle("dark", !!res.dark);
          setInfo({ title: res.title, page: res.page.name, index: res.pageIndex, count: res.pageCount });
          if (pageChanged) follow.current = true;
          if (follow.current) fit();
          dirty.current = true;
        }
        setStatus("live");
        timer = setTimeout(tick, POLL_MS);
      } catch (err) {
        if (!alive) return;
        if (err.status === 404) return setStatus("ended");
        setStatus("offline");
        timer = setTimeout(tick, POLL_MS * 3);
      }
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [code]);

  // canvas size + render loop
  useEffect(() => {
    const cv = canvasRef.current;
    const size = () => {
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(window.innerWidth * dpr);
      cv.height = Math.round(window.innerHeight * dpr);
      cv.style.width = window.innerWidth + "px";
      cv.style.height = window.innerHeight + "px";
      if (follow.current) fit();
      dirty.current = true;
    };
    size();
    window.addEventListener("resize", size);
    setAssetListener(() => (dirty.current = true));
    let raf;
    const loop = () => {
      if (dirty.current) {
        dirty.current = false;
        const ctx = cv.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const W = cv.width / dpr,
          H = cv.height / dpr,
          c = cam.current,
          { dark, bg, elements } = board.current;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawBackground(ctx, W, H, c, bg, dark);
        ctx.setTransform(dpr * c.z, 0, 0, dpr * c.z, dpr * c.x, dpr * c.y);
        const view = { x: -c.x / c.z, y: -c.y / c.z, w: W / c.z, h: H / c.z };
        for (const el of elements) if (G.intersects(G.getBounds(el), view)) drawElement(ctx, el, { dark, presenting: true });
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pan (drag) and zoom (wheel / pinch)
  const pointers = useRef(new Map());
  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    follow.current = false;
    drag.current =
      pts.length === 2
        ? { d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1, cam0: cam.current, m: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } }
        : { sx: e.clientX, sy: e.clientY, cam0: cam.current };
  };
  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId) || !drag.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current,
      pts = [...pointers.current.values()];
    if (d.d0 && pts.length === 2) {
      const z = clampZ((d.cam0.z * Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)) / d.d0);
      const wx = (d.m.x - d.cam0.x) / d.cam0.z,
        wy = (d.m.y - d.cam0.y) / d.cam0.z;
      cam.current = { z, x: (pts[0].x + pts[1].x) / 2 - wx * z, y: (pts[0].y + pts[1].y) / 2 - wy * z };
    } else if (!d.d0) cam.current = { ...d.cam0, x: d.cam0.x + e.clientX - d.sx, y: d.cam0.y + e.clientY - d.sy };
    dirty.current = true;
  };
  const onUp = (e) => {
    pointers.current.delete(e.pointerId);
    drag.current = null;
  };
  useEffect(() => {
    const cv = canvasRef.current;
    const wheel = (e) => {
      e.preventDefault();
      follow.current = false;
      const c = cam.current;
      if (e.ctrlKey || e.metaKey) {
        const z = clampZ(c.z * Math.exp(-Math.max(-50, Math.min(50, e.deltaY)) * 0.005));
        cam.current = { z, x: e.clientX - ((e.clientX - c.x) * z) / c.z, y: e.clientY - ((e.clientY - c.y) * z) / c.z };
      } else cam.current = { ...c, x: c.x - e.deltaX, y: c.y - e.deltaY };
      dirty.current = true;
    };
    cv.addEventListener("wheel", wheel, { passive: false });
    return () => cv.removeEventListener("wheel", wheel);
  }, []);

  const badge = {
    connecting: ["bg-amber-400", "Connecting…"],
    live: ["bg-emerald-500 animate-pulse", "Live"],
    offline: ["bg-amber-400", "Reconnecting…"],
    ended: ["bg-zinc-400", "This live view has ended"],
  }[status];

  return (
    <div className="fixed inset-0 select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={() => {
          follow.current = true;
          fit();
        }}
        aria-label="Live whiteboard"
      />
      <div className="fixed top-[var(--ui-top)] left-[var(--ui-left)] right-[var(--ui-right)] flex items-center gap-2 pointer-events-none">
        <div className="panel pointer-events-auto flex items-center gap-2.5 h-11 px-3.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 min-w-0">
          {status === "offline" || status === "ended" ? <WifiOff size={16} className="shrink-0" /> : <Radio size={16} className="shrink-0 text-emerald-500" />}
          <span className={`w-2 h-2 rounded-full shrink-0 ${badge[0]}`} />
          <span className="shrink-0">{badge[1]}</span>
          {info.title && status !== "ended" && (
            <span className="truncate text-zinc-500 dark:text-zinc-400">
              · {info.title} · {info.page} ({info.index + 1}/{info.count})
            </span>
          )}
        </div>
        <button
          className="panel icon-btn !w-11 !h-11 pointer-events-auto ml-auto"
          title="Fit to screen (double-click)"
          aria-label="Fit to screen"
          onClick={() => {
            follow.current = true;
            fit();
          }}
        >
          <Maximize size={18} />
        </button>
      </div>
    </div>
  );
}
