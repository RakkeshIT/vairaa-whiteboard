// Function plotter element: { type: "graph", x, y, w, h, fns: [{ expr, color }], xMin, xMax, yMin, yMax }
import { compileSafe } from "./expr";

export const GRAPH_COLORS = ["#1971c2", "#e03131", "#2f9e44", "#f08c00", "#9c36b5"];
export const GRAPH_DEFAULTS = { w: 560, h: 400, xMin: -10, xMax: 10, yMin: -7, yMax: 7 };

/** 1, 2 or 5 × 10^n step that gives about `target` divisions. */
function niceStep(range, target = 10) {
  const raw = range / target;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}
const label = (v, step) => {
  const d = Math.max(0, -Math.floor(Math.log10(step)));
  return (Math.abs(v) < step / 1e6 ? 0 : v).toFixed(d);
};

/** Draw a graph into box b (world units; ctx already carries the camera transform). */
export function drawGraph(ctx, el, b, { dark = false } = {}) {
  const { xMin, xMax, yMin, yMax } = el;
  if (!(xMax > xMin) || !(yMax > yMin) || b.w < 2 || b.h < 2) return;
  const X = (x) => b.x + ((x - xMin) / (xMax - xMin)) * b.w;
  const Y = (y) => b.y + ((yMax - y) / (yMax - yMin)) * b.h;
  const k = Math.min(b.w / 560, b.h / 400); // scale text / strokes with the element
  const fs = Math.max(8, 13 * k);

  ctx.save();
  ctx.fillStyle = dark ? "#1b1e25" : "#ffffff";
  ctx.strokeStyle = dark ? "#3a3f4a" : "#d4d4d8";
  ctx.lineWidth = 1.5 * k;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 10 * k);
  else ctx.rect(b.x, b.y, b.w, b.h);
  ctx.fill();
  ctx.stroke();
  ctx.clip();

  // grid
  const sx = niceStep(xMax - xMin),
    sy = niceStep(yMax - yMin, 8);
  ctx.beginPath();
  for (let x = Math.ceil(xMin / sx) * sx; x <= xMax; x += sx) {
    ctx.moveTo(X(x), b.y);
    ctx.lineTo(X(x), b.y + b.h);
  }
  for (let y = Math.ceil(yMin / sy) * sy; y <= yMax; y += sy) {
    ctx.moveTo(b.x, Y(y));
    ctx.lineTo(b.x + b.w, Y(y));
  }
  ctx.strokeStyle = dark ? "#2a2e37" : "#eef0f3";
  ctx.lineWidth = 1 * k;
  ctx.stroke();

  // axes (pinned to the edge when 0 is out of range)
  const ax = Math.min(Math.max(X(0), b.x), b.x + b.w),
    ay = Math.min(Math.max(Y(0), b.y), b.y + b.h);
  const axis = dark ? "#9ca3af" : "#52525b";
  ctx.beginPath();
  ctx.moveTo(b.x, ay);
  ctx.lineTo(b.x + b.w, ay);
  ctx.moveTo(ax, b.y);
  ctx.lineTo(ax, b.y + b.h);
  ctx.strokeStyle = axis;
  ctx.lineWidth = 1.6 * k;
  ctx.stroke();

  // tick labels
  ctx.fillStyle = axis;
  ctx.font = `${fs}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const lx = ay + fs * 1.4 > b.y + b.h ? ay - fs * 1.3 : ay + 3 * k;
  for (let x = Math.ceil(xMin / sx) * sx; x <= xMax; x += sx)
    if (Math.abs(x) > sx / 2 && X(x) > b.x + fs && X(x) < b.x + b.w - fs) ctx.fillText(label(x, sx), X(x), lx);
  ctx.textAlign = ax + fs * 3 > b.x + b.w ? "right" : "left";
  ctx.textBaseline = "middle";
  const ly = ctx.textAlign === "right" ? ax - 4 * k : ax + 4 * k;
  for (let y = Math.ceil(yMin / sy) * sy; y <= yMax; y += sy)
    if (Math.abs(y) > sy / 2 && Y(y) > b.y + fs && Y(y) < b.y + b.h - fs) ctx.fillText(label(y, sy), ly, Y(y));

  // curves
  const n = Math.min(2000, Math.max(200, Math.round(b.w * 1.5)));
  const yr = yMax - yMin;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  (el.fns || []).forEach((g) => {
    const f = compileSafe(g.expr);
    if (!f) return;
    ctx.beginPath();
    let pen = false,
      prev = null;
    for (let i = 0; i <= n; i++) {
      const x = xMin + ((xMax - xMin) * i) / n;
      let y;
      try {
        y = f(x);
      } catch {
        y = NaN;
      }
      // break at gaps and asymptotes (huge jumps, e.g. tan x)
      if (!Number.isFinite(y) || (prev !== null && Math.abs(y - prev) > yr * 4)) {
        pen = false;
        prev = Number.isFinite(y) ? y : null;
        if (!Number.isFinite(y)) continue;
      }
      const py = Y(Math.max(yMin - yr * 2, Math.min(yMax + yr * 2, y)));
      if (pen) ctx.lineTo(X(x), py);
      else ctx.moveTo(X(x), py);
      pen = true;
      prev = y;
    }
    ctx.strokeStyle = g.color || GRAPH_COLORS[0];
    ctx.lineWidth = Math.max(1.5, (el.strokeWidth || 3) * k);
    ctx.stroke();
  });

  // legend
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `600 ${fs * 1.05}px Inter, ui-sans-serif, system-ui, sans-serif`;
  (el.fns || []).forEach((g, i) => {
    const text = `y = ${String(g.expr).replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=\s*/i, "")}`;
    const tx = b.x + 10 * k,
      ty = b.y + 8 * k + i * fs * 1.5;
    ctx.fillStyle = dark ? "rgba(27,30,37,0.85)" : "rgba(255,255,255,0.85)";
    ctx.fillRect(tx - 3 * k, ty - 2 * k, ctx.measureText(text).width + 6 * k, fs * 1.35);
    ctx.fillStyle = g.color || GRAPH_COLORS[0];
    ctx.fillText(text, tx, ty);
  });
  ctx.restore();
}

/** PNG data URL of a graph (used by SVG export). */
export function graphToDataURL(el, b, dark) {
  const s = 2;
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.ceil(b.w * s));
  cv.height = Math.max(1, Math.ceil(b.h * s));
  const ctx = cv.getContext("2d");
  ctx.setTransform(s, 0, 0, s, -b.x * s, -b.y * s);
  drawGraph(ctx, el, b, { dark });
  return cv.toDataURL("image/png");
}
