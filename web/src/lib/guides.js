// Geometry guides: a ruler and a protractor that sit on the board, can be dragged / rotated,
// and make pen strokes started along their edge follow it. Plus compass drawing helpers.
// Guides are session-only (not saved in the document). World units throughout.

export const RULER = { len: 680, w: 76 };
export const PROTRACTOR = { r: 230, strip: 16 };
const KNOB = 15;
const SNAP_RANGE = 30; // screen px from an edge that still snaps
const ACCENT = "#6965db";

export const newRuler = (x, y) => ({ kind: "ruler", x, y, a: 0 });
export const newProtractor = (x, y) => ({ kind: "protractor", x, y: y + PROTRACTOR.r / 2, a: 0 });

/** World → guide-local coordinates (origin at guide centre / protractor base centre, x along it). */
export function toLocal(g, wx, wy) {
  const dx = wx - g.x,
    dy = wy - g.y,
    c = Math.cos(-g.a),
    s = Math.sin(-g.a);
  return [dx * c - dy * s, dx * s + dy * c];
}
export function toWorld(g, lx, ly) {
  const c = Math.cos(g.a),
    s = Math.sin(g.a);
  return [g.x + lx * c - ly * s, g.y + lx * s + ly * c];
}

const knobLocal = (g) => (g.kind === "ruler" ? [RULER.len / 2 - 30, 0] : [PROTRACTOR.r * 0.5, PROTRACTOR.strip / 2]);

/** What part of the guide is under (wx, wy): "rotate" | "body" | null. z = camera zoom. */
export function hitGuide(g, wx, wy, z) {
  const [lx, ly] = toLocal(g, wx, wy);
  const [kx, ky] = knobLocal(g);
  if (Math.hypot(lx - kx, ly - ky) <= KNOB + 6 / z) return "rotate";
  if (g.kind === "ruler") return Math.abs(lx) <= RULER.len / 2 && Math.abs(ly) <= RULER.w / 2 ? "body" : null;
  const { r, strip } = PROTRACTOR;
  if (ly <= 0 && Math.hypot(lx, ly) <= r) return "body";
  if (ly > 0 && ly <= strip && Math.abs(lx) <= r) return "body";
  return null;
}

/** If a stroke starting at (wx, wy) should follow this guide, describe how; else null. */
export function snapFor(g, wx, wy, z) {
  const [lx, ly] = toLocal(g, wx, wy);
  const range = SNAP_RANGE / z;
  if (g.kind === "ruler") {
    const off = Math.abs(ly) - RULER.w / 2;
    if (off >= -2 / z && off <= range && Math.abs(lx) <= RULER.len / 2 + range)
      return { g, edge: "line", y: Math.sign(ly) * (RULER.w / 2), half: RULER.len / 2 };
    return null;
  }
  const { r, strip } = PROTRACTOR;
  const d = Math.hypot(lx, ly);
  if (ly < 0 && d >= r - 2 / z && d <= r + range) return { g, edge: "arc" };
  if (ly > strip - 2 / z && ly <= strip + range && Math.abs(lx) <= r + range)
    return { g, edge: "line", y: strip, half: r };
  return null;
}

/** Project a pen point onto the guide edge described by `snap`, offset by the stroke's half width. */
export function applySnap(snap, wx, wy, strokeWidth) {
  const { g } = snap;
  const [lx, ly] = toLocal(g, wx, wy);
  const off = strokeWidth / 2 + 1;
  if (snap.edge === "line") {
    const x = Math.max(-snap.half, Math.min(snap.half, lx));
    return toWorld(g, x, snap.y + Math.sign(snap.y || 1) * off);
  }
  let an = Math.atan2(ly, lx);
  if (an > 0) an = lx >= 0 ? 0 : -Math.PI; // stay on the upper arc
  const R = PROTRACTOR.r + off;
  return toWorld(g, R * Math.cos(an), R * Math.sin(an));
}

/** Angle in degrees (0–180) of a protractor-local direction, measured like a real protractor. */
const deg = (rad) => ((rad * 180) / Math.PI + 360) % 360;

/** Draw the guide. ctx carries the camera transform; z = zoom (keeps hairlines crisp). */
export function drawGuide(ctx, g, z, dark, { rotating = false } = {}) {
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.a);
  const ink = dark ? "rgba(230,232,240,0.9)" : "rgba(30,30,40,0.85)";
  const body = dark ? "rgba(70,90,140,0.32)" : "rgba(180,200,240,0.38)";
  const edge = dark ? "rgba(160,180,255,0.7)" : "rgba(80,100,200,0.65)";
  ctx.lineWidth = 1 / z;
  ctx.fillStyle = body;
  ctx.strokeStyle = edge;
  ctx.font = `${12}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";

  if (g.kind === "ruler") {
    const { len, w } = RULER;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-len / 2, -w / 2, len, w, 6);
    else ctx.rect(-len / 2, -w / 2, len, w);
    ctx.fill();
    ctx.stroke();
    // ticks on both edges: every 10 units, longer every 50, labelled every 100
    ctx.beginPath();
    const start = -len / 2 + 20;
    for (let i = 0, x = start; x <= len / 2 - 20 + 0.01; i++, x += 10) {
      const t = i % 10 === 0 ? 18 : i % 5 === 0 ? 12 : 7;
      ctx.moveTo(x, -w / 2);
      ctx.lineTo(x, -w / 2 + t);
      ctx.moveTo(x, w / 2);
      ctx.lineTo(x, w / 2 - t);
    }
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.textBaseline = "top";
    for (let i = 0, x = start; x <= len / 2 - 20 + 0.01; i += 10, x += 100) ctx.fillText(String(i / 10), x, -w / 2 + 21);
  } else {
    const { r, strip } = PROTRACTOR;
    ctx.beginPath();
    ctx.moveTo(-r, strip);
    ctx.lineTo(-r, 0);
    ctx.arc(0, 0, r, Math.PI, 0);
    ctx.lineTo(r, strip);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let d = 0; d <= 180; d++) {
      const an = Math.PI + (d * Math.PI) / 180;
      const t = d % 10 === 0 ? 20 : d % 5 === 0 ? 13 : 7;
      const c = Math.cos(an),
        s = Math.sin(an);
      ctx.moveTo(c * r, s * r);
      ctx.lineTo(c * (r - t), s * (r - t));
    }
    // centre mark + base line
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -10);
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.textBaseline = "middle";
    for (let d = 0; d <= 180; d += 10) {
      const an = Math.PI + (d * Math.PI) / 180;
      ctx.fillText(String(d), Math.cos(an) * (r - 34), Math.sin(an) * (r - 34));
      if (d % 30 === 0 && d > 0 && d < 180)
        ctx.fillText(String(180 - d), Math.cos(an) * (r - 54), Math.sin(an) * (r - 54));
    }
  }

  // rotate knob
  const [kx, ky] = knobLocal(g);
  ctx.beginPath();
  ctx.arc(kx, ky, g.kind === "ruler" ? KNOB : 10, 0, Math.PI * 2);
  ctx.fillStyle = ACCENT;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(kx, ky, g.kind === "ruler" ? 7 : 5, -Math.PI * 0.8, Math.PI * 0.5);
  ctx.stroke();

  if (rotating) {
    const a = Math.round(deg(-g.a)) % 360;
    ctx.rotate(-g.a);
    ctx.font = `600 ${16 / z}px Inter, ui-sans-serif, system-ui, sans-serif`;
    const text = `${a}°`;
    const tw = ctx.measureText(text).width + 14 / z;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-tw / 2, -RULER.w / 2 - 36 / z, tw, 24 / z, 8 / z);
    else ctx.rect(-tw / 2, -RULER.w / 2 - 36 / z, tw, 24 / z);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, -RULER.w / 2 - 24 / z);
  }
  ctx.restore();
}

/** Rotation that snaps to 15° steps when close. */
export function snapAngle(a) {
  const step = Math.PI / 12;
  const n = Math.round(a / step) * step;
  return Math.abs(a - n) < (3 * Math.PI) / 180 ? n : a;
}

// ---------- compass ----------
/** Draw the compass guide: centre, radius arm and a faint full circle. */
export function drawCompass(ctx, c, z, dark) {
  if (!c) return;
  ctx.save();
  const col = dark ? "rgba(160,180,255,0.75)" : "rgba(80,100,200,0.7)";
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.2 / z;
  ctx.setLineDash([6 / z, 5 / z]);
  ctx.beginPath();
  ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
  ctx.stroke();
  const hx = c.cx + c.r * Math.cos(c.ha || 0),
    hy = c.cy + c.r * Math.sin(c.ha || 0);
  ctx.beginPath();
  ctx.moveTo(c.cx, c.cy);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(c.cx, c.cy, 5 / z, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx, hy, 6 / z, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2 / z;
  ctx.stroke();
  // radius readout
  ctx.font = `600 ${12 / z}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = col;
  ctx.textAlign = "center";
  ctx.fillText(`r = ${Math.round(c.r)}`, (c.cx + hx) / 2, (c.cy + hy) / 2 - 8 / z);
  ctx.restore();
}
