import { getStroke } from "perfect-freehand";
import { getBounds, hasFill, unionBounds } from "./elements";

export const FONTS = {
  hand: '"Caveat", "Segoe Print", cursive',
  sans: 'Inter, ui-sans-serif, system-ui, "Segoe UI", sans-serif',
  mono: 'ui-monospace, "Cascadia Code", Consolas, monospace',
};
export const LINE_HEIGHT = 1.25;
export const STICKY_PAD = 14;
export const INK = "#1e1e1e";
export const fontOf = (el) =>
  `${el.italic ? "italic " : ""}${el.bold ? "700 " : ""}${el.fontSize}px ${FONTS[el.font] || FONTS.sans}`;
export const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

/** Black or white text, whichever reads better on `hex`. */
export function contrastText(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? "#111827" : "#ffffff";
}

function underline(ctx, text, x, y, size) {
  const w = ctx.measureText(text).width;
  if (!w) return;
  ctx.fillRect(x, y + size * 1.02, w, Math.max(1, size / 14));
}

/** Default ink flips to light on dark boards so drawings stay visible. */
export const colorFor = (c, dark) => (dark && c === INK ? "#e9e9ee" : !dark && c === "#ffffff" ? "#ffffff" : c);

// ---------- assets ----------
const imgCache = new Map();
let onAssetLoad = () => {};
export const setAssetListener = (fn) => (onAssetLoad = fn);
export function getImage(src) {
  let img = imgCache.get(src);
  if (!img) {
    img = new Image();
    img.onload = () => onAssetLoad();
    img.src = src;
    imgCache.set(src, img);
  }
  return img;
}

// ---------- text ----------
const mctx = document.createElement("canvas").getContext("2d");
export function measureText(el) {
  mctx.font = fontOf(el);
  const lines = (el.text || "").split("\n");
  const w = Math.max(el.fontSize * 0.6, ...lines.map((l) => mctx.measureText(l).width));
  return { w: Math.ceil(w) + 2, h: Math.ceil(lines.length * el.fontSize * LINE_HEIGHT) };
}
export const fitText = (el) => (el.type === "text" ? { ...el, ...measureText(el) } : el);

export function wrapText(ctx, text, maxW) {
  const out = [];
  for (const para of (text || "").split("\n")) {
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const test = line + word;
      if (ctx.measureText(test).width <= maxW) {
        line = test;
        continue;
      }
      if (line.trim()) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else line = test;
      // a single word longer than the box: hard-break it
      while (line.length > 1 && ctx.measureText(line).width > maxW) {
        let i = line.length - 1;
        while (i > 1 && ctx.measureText(line.slice(0, i)).width > maxW) i--;
        out.push(line.slice(0, i));
        line = line.slice(i);
      }
    }
    out.push(line);
  }
  return out;
}

// ---------- freehand ----------
const pathCache = new WeakMap();
export function freehandOutline(el) {
  const hl = el.type === "hl";
  return getStroke(el.points, {
    size: hl ? el.strokeWidth * 3 + 10 : el.strokeWidth * 1.5 + 1.5,
    thinning: hl ? 0 : 0.55,
    smoothing: 0.6,
    streamline: hl ? 0.6 : 0.45,
    simulatePressure: !el.pressure,
    last: true,
  });
}
export function svgPathFromStroke(pts) {
  if (!pts.length) return "";
  const d = ["M", pts[0][0].toFixed(2), pts[0][1].toFixed(2), "Q"];
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    d.push(x0.toFixed(2), y0.toFixed(2), ((x0 + x1) / 2).toFixed(2), ((y0 + y1) / 2).toFixed(2));
  }
  d.push("Z");
  return d.join(" ");
}
function freehandPath(el, noCache) {
  const key = el.type + el.strokeWidth;
  const hit = !noCache && pathCache.get(el.points);
  if (hit && hit.key === key) return hit.p;
  const p = new Path2D(svgPathFromStroke(freehandOutline(el)));
  if (!noCache) pathCache.set(el.points, { key, p });
  return p;
}

function setDash(ctx, el) {
  const w = el.strokeWidth || 1;
  if (el.strokeStyle === "dashed") ctx.setLineDash([w * 3 + 4, w * 2 + 4]);
  else if (el.strokeStyle === "dotted") ctx.setLineDash([0.1, w * 2 + 3]);
  else ctx.setLineDash([]);
}

function boxPath(ctx, el, b) {
  ctx.beginPath();
  if (el.type === "rect") {
    const r = Math.min(10, b.w / 4, b.h / 4);
    if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, r);
    else ctx.rect(b.x, b.y, b.w, b.h);
  } else if (el.type === "ellipse") {
    ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
  } else {
    const cx = b.x + b.w / 2,
      cy = b.y + b.h / 2;
    ctx.moveTo(cx, b.y);
    ctx.lineTo(b.x + b.w, cy);
    ctx.lineTo(cx, b.y + b.h);
    ctx.lineTo(b.x, cy);
    ctx.closePath();
  }
}

/** Draw one element in world space (ctx must already carry the camera transform). */
export function drawElement(ctx, el, { dark = false, noCache = false, hideText = false, ghost = false } = {}) {
  ctx.save();
  ctx.globalAlpha = (el.opacity ?? 1) * (ghost ? 0.25 : 1);
  const stroke = colorFor(el.stroke, dark);
  ctx.strokeStyle = stroke;
  ctx.fillStyle = stroke;
  ctx.lineWidth = el.strokeWidth || 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (el.type) {
    case "pen":
    case "hl": {
      if (el.type === "hl") {
        ctx.globalAlpha *= dark ? 0.45 : 0.4;
        if (!dark) ctx.globalCompositeOperation = "multiply";
      }
      ctx.fill(freehandPath(el, noCache));
      break;
    }
    case "line":
    case "arrow": {
      const [a, b] = el.points;
      setDash(ctx, el);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      if (el.type === "arrow" && Math.hypot(b[0] - a[0], b[1] - a[1]) > 1) {
        const an = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const h = 8 + el.strokeWidth * 2.4;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(b[0], b[1]);
        ctx.lineTo(b[0] - h * Math.cos(an - 0.45), b[1] - h * Math.sin(an - 0.45));
        ctx.lineTo(b[0] - h * Math.cos(an + 0.45), b[1] - h * Math.sin(an + 0.45));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "rect":
    case "ellipse":
    case "diamond": {
      const b = getBounds(el);
      boxPath(ctx, el, b);
      if (hasFill(el)) {
        ctx.fillStyle = el.fill;
        ctx.fill();
      }
      setDash(ctx, el);
      ctx.stroke();
      break;
    }
    case "text": {
      if (hideText) break;
      ctx.font = fontOf(el);
      ctx.textBaseline = "top";
      (el.text || "").split("\n").forEach((ln, i) => {
        const y = el.y + i * el.fontSize * LINE_HEIGHT;
        ctx.fillText(ln, el.x, y);
        if (el.underline) underline(ctx, ln, el.x, y, el.fontSize);
      });
      break;
    }
    case "sticky": {
      const b = getBounds(el);
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 5;
      ctx.fillStyle = el.fill;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 6);
      else ctx.rect(b.x, b.y, b.w, b.h);
      ctx.fill();
      ctx.shadowColor = "transparent";
      if (hideText) break;
      ctx.save();
      ctx.clip();
      ctx.fillStyle = "#1f2937";
      ctx.font = fontOf(el);
      ctx.textBaseline = "top";
      wrapText(ctx, el.text, b.w - STICKY_PAD * 2).forEach((ln, i) => {
        const y = b.y + STICKY_PAD + i * el.fontSize * LINE_HEIGHT;
        ctx.fillText(ln, b.x + STICKY_PAD, y);
        if (el.underline) underline(ctx, ln, b.x + STICKY_PAD, y, el.fontSize);
      });
      ctx.restore();
      break;
    }
    case "stamp": {
      const b = getBounds(el);
      const s = Math.min(b.w, b.h),
        cx = b.x + b.w / 2,
        cy = b.y + b.h / 2;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (el.kind === "number") {
        ctx.beginPath();
        ctx.arc(cx, cy, s / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke;
        ctx.fill();
        ctx.fillStyle = contrastText(stroke);
        const len = String(el.value).length;
        ctx.font = `700 ${s * (len > 2 ? 0.38 : len > 1 ? 0.46 : 0.56)}px ${FONTS.sans}`;
        ctx.fillText(String(el.value), cx, cy + s * 0.03);
      } else {
        ctx.font = `${s * 0.86}px ${EMOJI_FONT}`;
        ctx.fillText(el.value, cx, cy + s * 0.06);
      }
      break;
    }
    case "image": {
      const b = getBounds(el);
      const img = getImage(el.src);
      if (img.complete && img.naturalWidth) ctx.drawImage(img, b.x, b.y, b.w, b.h);
      else {
        ctx.fillStyle = dark ? "#27272a" : "#f4f4f5";
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      break;
    }
  }
  ctx.restore();
}

// ---------- background ----------
export function drawBackground(ctx, W, H, cam, bg, dark) {
  ctx.fillStyle = dark ? "#16181d" : "#ffffff";
  ctx.fillRect(0, 0, W, H);
  if (bg === "plain") return;
  let step = bg === "lines" ? 32 : 24;
  while (step * cam.z < 14) step *= 2;
  const s = step * cam.z;
  const ox = ((cam.x % s) + s) % s,
    oy = ((cam.y % s) + s) % s;
  ctx.beginPath();
  if (bg === "grid") {
    for (let x = ox; x < W; x += s) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, H);
    }
    for (let y = oy; y < H; y += s) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(W, Math.round(y) + 0.5);
    }
    ctx.strokeStyle = dark ? "#23262d" : "#eef0f3";
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (bg === "dots") {
    const r = Math.max(0.7, Math.min(1.5, 1.3 * cam.z));
    for (let x = ox; x < W; x += s) for (let y = oy; y < H; y += s) ctx.rect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = dark ? "#3a3f4a" : "#c5cad3";
    ctx.fill();
  } else if (bg === "lines") {
    for (let y = oy; y < H; y += s) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(W, Math.round(y) + 0.5);
    }
    ctx.strokeStyle = dark ? "#1f2a3d" : "#dbe7fb";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ---------- selection UI (screen space) ----------
export const ACCENT = "#6965db";
const HANDLE_PAD = 5;
export const toScreenBox = (b, cam) => ({ x: b.x * cam.z + cam.x, y: b.y * cam.z + cam.y, w: b.w * cam.z, h: b.h * cam.z });

/** Handle positions in screen coords for the selection. */
export function getHandles(selEls, cam) {
  if (!selEls.length) return [];
  if (selEls.length === 1 && (selEls[0].type === "line" || selEls[0].type === "arrow")) {
    return selEls[0].points.map((p, i) => ({ id: "p" + i, x: p[0] * cam.z + cam.x, y: p[1] * cam.z + cam.y }));
  }
  const b = toScreenBox(unionBounds(selEls), cam);
  const x1 = b.x - HANDLE_PAD,
    y1 = b.y - HANDLE_PAD,
    x2 = b.x + b.w + HANDLE_PAD,
    y2 = b.y + b.h + HANDLE_PAD;
  const mx = (x1 + x2) / 2,
    my = (y1 + y2) / 2;
  const hs = [
    { id: "nw", x: x1, y: y1 },
    { id: "ne", x: x2, y: y1 },
    { id: "se", x: x2, y: y2 },
    { id: "sw", x: x1, y: y2 },
  ];
  if (b.w > 30) hs.push({ id: "n", x: mx, y: y1 }, { id: "s", x: mx, y: y2 });
  if (b.h > 30) hs.push({ id: "e", x: x2, y: my }, { id: "w", x: x1, y: my });
  return hs;
}

export function drawSelectionUI(ctx, cam, selEls, marquee, dark) {
  ctx.save();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1;
  if (selEls.length) {
    const linear = selEls.length === 1 && (selEls[0].type === "line" || selEls[0].type === "arrow");
    if (selEls.length > 1) {
      ctx.setLineDash([4, 3]);
      for (const el of selEls) {
        const b = toScreenBox(getBounds(el), cam);
        ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
      }
      ctx.setLineDash([]);
    }
    if (!linear) {
      const b = toScreenBox(unionBounds(selEls), cam);
      ctx.strokeRect(b.x - HANDLE_PAD + 0.5, b.y - HANDLE_PAD + 0.5, b.w + HANDLE_PAD * 2, b.h + HANDLE_PAD * 2);
    }
    ctx.fillStyle = dark ? "#16181d" : "#ffffff";
    for (const h of getHandles(selEls, cam)) {
      ctx.beginPath();
      if (linear) ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
      else if (ctx.roundRect) ctx.roundRect(h.x - 4.5, h.y - 4.5, 9, 9, 2);
      else ctx.rect(h.x - 4.5, h.y - 4.5, 9, 9);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (marquee) {
    const b = toScreenBox(marquee, cam);
    ctx.fillStyle = "rgba(105,101,219,0.08)";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
  }
  ctx.restore();
}

// ---------- export ----------
export function renderToCanvas(els, { dark, scale = 2, pad = 32, background = true }) {
  const b = unionBounds(els);
  if (!b) return null;
  const W = Math.ceil((b.w + pad * 2) * scale),
    H = Math.ceil((b.h + pad * 2) * scale);
  const max = 8192;
  const k = Math.min(1, max / W, max / H);
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(W * k);
  cv.height = Math.ceil(H * k);
  const ctx = cv.getContext("2d");
  if (background) {
    ctx.fillStyle = dark ? "#16181d" : "#ffffff";
    ctx.fillRect(0, 0, cv.width, cv.height);
  }
  const s = scale * k;
  ctx.setTransform(s, 0, 0, s, (pad - b.x) * s, (pad - b.y) * s);
  for (const el of els) drawElement(ctx, el, { dark });
  return cv;
}

const fmt = (el) =>
  `${el.bold ? ' font-weight="700"' : ""}${el.italic ? ' font-style="italic"' : ""}${el.underline ? ' text-decoration="underline"' : ""}`;

/** Vector SVG export. */
export function renderToSVG(els, { dark, pad = 32, background = true }) {
  const b = unionBounds(els);
  if (!b) return null;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const W = b.w + pad * 2,
    H = b.h + pad * 2;
  const parts = [];
  const dash = (el) => {
    const w = el.strokeWidth || 1;
    if (el.strokeStyle === "dashed") return ` stroke-dasharray="${w * 3 + 4} ${w * 2 + 4}"`;
    if (el.strokeStyle === "dotted") return ` stroke-dasharray="0.1 ${w * 2 + 3}"`;
    return "";
  };
  for (const el of els) {
    const op = el.opacity ?? 1;
    const st = colorFor(el.stroke, dark);
    const common = `stroke="${st}" stroke-width="${el.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"`;
    const fill = hasFill(el) ? el.fill : "none";
    const bb = getBounds(el);
    switch (el.type) {
      case "pen":
      case "hl":
        parts.push(
          `<path d="${svgPathFromStroke(freehandOutline(el))}" fill="${st}" opacity="${el.type === "hl" ? op * 0.4 : op}"${el.type === "hl" && !dark ? ' style="mix-blend-mode:multiply"' : ""}/>`,
        );
        break;
      case "line":
      case "arrow": {
        const [a, c] = el.points;
        parts.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${c[0]}" y2="${c[1]}" ${common}${dash(el)}/>`);
        if (el.type === "arrow") {
          const an = Math.atan2(c[1] - a[1], c[0] - a[0]),
            h = 8 + el.strokeWidth * 2.4;
          const p1 = [c[0] - h * Math.cos(an - 0.45), c[1] - h * Math.sin(an - 0.45)];
          const p2 = [c[0] - h * Math.cos(an + 0.45), c[1] - h * Math.sin(an + 0.45)];
          parts.push(`<polygon points="${c[0]},${c[1]} ${p1} ${p2}" fill="${st}" ${common}/>`);
        }
        break;
      }
      case "rect":
        parts.push(
          `<rect x="${bb.x}" y="${bb.y}" width="${bb.w}" height="${bb.h}" rx="${Math.min(10, bb.w / 4, bb.h / 4)}" fill="${fill}" ${common}${dash(el)}/>`,
        );
        break;
      case "ellipse":
        parts.push(
          `<ellipse cx="${bb.x + bb.w / 2}" cy="${bb.y + bb.h / 2}" rx="${bb.w / 2}" ry="${bb.h / 2}" fill="${fill}" ${common}${dash(el)}/>`,
        );
        break;
      case "diamond": {
        const cx = bb.x + bb.w / 2,
          cy = bb.y + bb.h / 2;
        parts.push(
          `<polygon points="${cx},${bb.y} ${bb.x + bb.w},${cy} ${cx},${bb.y + bb.h} ${bb.x},${cy}" fill="${fill}" ${common}${dash(el)}/>`,
        );
        break;
      }
      case "text":
        (el.text || "").split("\n").forEach((ln, i) =>
          parts.push(
            `<text x="${el.x}" y="${el.y + i * el.fontSize * LINE_HEIGHT}" dominant-baseline="hanging" font-size="${el.fontSize}" font-family='${FONTS[el.font] || FONTS.sans}'${fmt(el)} fill="${st}" opacity="${op}" xml:space="preserve">${esc(ln)}</text>`,
          ),
        );
        break;
      case "sticky": {
        parts.push(`<rect x="${bb.x}" y="${bb.y}" width="${bb.w}" height="${bb.h}" rx="6" fill="${el.fill}" opacity="${op}"/>`);
        mctx.font = fontOf(el);
        wrapText(mctx, el.text, bb.w - STICKY_PAD * 2).forEach((ln, i) =>
          parts.push(
            `<text x="${bb.x + STICKY_PAD}" y="${bb.y + STICKY_PAD + i * el.fontSize * LINE_HEIGHT}" dominant-baseline="hanging" font-size="${el.fontSize}" font-family='${FONTS[el.font] || FONTS.sans}'${fmt(el)} fill="#1f2937" opacity="${op}" xml:space="preserve">${esc(ln)}</text>`,
          ),
        );
        break;
      }
      case "stamp": {
        const s = Math.min(bb.w, bb.h),
          cx = bb.x + bb.w / 2,
          cy = bb.y + bb.h / 2;
        if (el.kind === "number") {
          const len = String(el.value).length;
          parts.push(
            `<circle cx="${cx}" cy="${cy}" r="${s / 2}" fill="${st}" opacity="${op}"/><text x="${cx}" y="${cy + s * 0.03}" text-anchor="middle" dominant-baseline="central" font-weight="700" font-size="${s * (len > 2 ? 0.38 : len > 1 ? 0.46 : 0.56)}" font-family='${FONTS.sans}' fill="${contrastText(st)}" opacity="${op}">${esc(el.value)}</text>`,
          );
        } else
          parts.push(
            `<text x="${cx}" y="${cy + s * 0.06}" text-anchor="middle" dominant-baseline="central" font-size="${s * 0.86}" font-family='${EMOJI_FONT}' opacity="${op}">${esc(el.value)}</text>`,
          );
        break;
      }
      case "image":
        parts.push(`<image href="${el.src}" x="${bb.x}" y="${bb.y}" width="${bb.w}" height="${bb.h}" opacity="${op}" preserveAspectRatio="none"/>`);
        break;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${b.x - pad} ${b.y - pad} ${W} ${H}">${
    background ? `<rect x="${b.x - pad}" y="${b.y - pad}" width="${W}" height="${H}" fill="${dark ? "#16181d" : "#ffffff"}"/>` : ""
  }${parts.join("")}</svg>`;
}
