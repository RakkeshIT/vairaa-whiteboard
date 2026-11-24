// Element model + geometry helpers (all coordinates are world units).
//
// Point elements (pen, hl, line, arrow) store absolute `points: [[x, y, pressure?], ...]`.
// Box elements (rect, ellipse, diamond, text, sticky, image, code, math) store `x, y, w, h`.

export const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

const POINT_TYPES = new Set(["pen", "hl", "line", "arrow"]);
export const isPointType = (t) => POINT_TYPES.has(t);
export const isLinear = (t) => t === "line" || t === "arrow";
export const isShape = (t) => t === "rect" || t === "ellipse" || t === "diamond";
export const hasFill = (el) => el.fill && el.fill !== "transparent";
// Elements sized by their content: resizing scales the font, then the box is re-fitted.
const SCALES_FONT = new Set(["text", "code", "math"]);
/** Locked elements (e.g. imported slides) can't be selected, moved or erased. */
export const isLocked = (el) => !!el.locked;

// Elements are immutable, so bounds can be cached per object (big pen strokes are O(points)).
const boundsCache = new WeakMap();
export function getBounds(el) {
  let b = boundsCache.get(el);
  if (!b) {
    b = computeBounds(el);
    boundsCache.set(el, b);
  }
  return b;
}

function computeBounds(el) {
  if (isPointType(el.type)) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of el.points) {
      if (p[0] < minX) minX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] > maxY) maxY = p[1];
    }
    const pad = el.type === "hl" ? el.strokeWidth * 1.5 + 5 : el.strokeWidth / 2 + 1;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }
  return {
    x: Math.min(el.x, el.x + el.w),
    y: Math.min(el.y, el.y + el.h),
    w: Math.abs(el.w),
    h: Math.abs(el.h),
  };
}

export function unionBounds(els) {
  if (!els.length) return null;
  let x1 = Infinity,
    y1 = Infinity,
    x2 = -Infinity,
    y2 = -Infinity;
  for (const el of els) {
    const b = getBounds(el);
    x1 = Math.min(x1, b.x);
    y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.w);
    y2 = Math.max(y2, b.y + b.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export const intersects = (a, b) =>
  a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;

export const inBounds = (b, x, y, pad = 0) =>
  x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;

export function normalize(el) {
  if (isPointType(el.type)) return el;
  const b = getBounds(el);
  return { ...el, x: b.x, y: b.y, w: b.w, h: b.h };
}

const movePoint = (p, dx, dy) => (p.length > 2 ? [p[0] + dx, p[1] + dy, p[2]] : [p[0] + dx, p[1] + dy]);

export function translate(el, dx, dy) {
  if (isPointType(el.type)) return { ...el, points: el.points.map((p) => movePoint(p, dx, dy)) };
  return { ...el, x: el.x + dx, y: el.y + dy };
}

export function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay;
  const len = dx * dx + dy * dy;
  let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Does world point (x, y) touch the element? `tol` is in world units. */
export function hitTest(el, x, y, tol) {
  const b = getBounds(el);
  if (!inBounds(b, x, y, tol)) return false;
  const sw = (el.strokeWidth || 1) / 2;
  switch (el.type) {
    case "pen":
    case "hl":
    case "line":
    case "arrow": {
      const t = tol + (el.type === "hl" ? el.strokeWidth * 1.5 + 5 : sw + 1);
      const p = el.points;
      if (p.length === 1) return Math.hypot(x - p[0][0], y - p[0][1]) <= t;
      for (let i = 1; i < p.length; i++)
        if (distToSeg(x, y, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]) <= t) return true;
      return false;
    }
    case "rect": {
      if (hasFill(el)) return true;
      const d = Math.min(
        Math.abs(x - b.x),
        Math.abs(x - b.x - b.w),
        Math.abs(y - b.y),
        Math.abs(y - b.y - b.h),
      );
      return d <= tol + sw;
    }
    case "ellipse": {
      const rx = b.w / 2,
        ry = b.h / 2;
      if (rx < 2 || ry < 2) return true;
      const d = Math.hypot((x - b.x - rx) / rx, (y - b.y - ry) / ry);
      if (hasFill(el) && d <= 1) return true;
      return Math.abs(d - 1) * Math.min(rx, ry) <= tol + sw;
    }
    case "diamond": {
      const cx = b.x + b.w / 2,
        cy = b.y + b.h / 2;
      if (hasFill(el) && Math.abs(x - cx) / (b.w / 2) + Math.abs(y - cy) / (b.h / 2) <= 1) return true;
      const pts = [
        [cx, b.y],
        [b.x + b.w, cy],
        [cx, b.y + b.h],
        [b.x, cy],
      ];
      for (let i = 0; i < 4; i++) {
        const a = pts[i],
          c = pts[(i + 1) % 4];
        if (distToSeg(x, y, a[0], a[1], c[0], c[1]) <= tol + sw) return true;
      }
      return false;
    }
    default:
      return true; // text, sticky, image: whole box is clickable
  }
}

/**
 * Map an element from old selection bounds B to new bounds N (N.w/N.h may be negative = flip).
 * `axis` = 'x' when resizing from a left/right edge (controls text scaling).
 */
export function scaleElement(el, B, N, axis) {
  const sx = B.w ? N.w / B.w : 1,
    sy = B.h ? N.h / B.h : 1;
  const mx = (x) => N.x + (x - B.x) * sx;
  const my = (y) => N.y + (y - B.y) * sy;
  if (isPointType(el.type)) {
    return {
      ...el,
      points: el.points.map((p) => (p.length > 2 ? [mx(p[0]), my(p[1]), p[2]] : [mx(p[0]), my(p[1])])),
    };
  }
  const x1 = mx(el.x),
    y1 = my(el.y),
    x2 = mx(el.x + el.w),
    y2 = my(el.y + el.h);
  const out = { ...el, x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  if (SCALES_FONT.has(el.type)) out.fontSize = Math.max(6, el.fontSize * Math.abs(axis === "x" ? sx : sy));
  return out;
}

/** Compute new bounds while dragging a resize handle. */
export function resizeBounds(B, handle, wx, wy, keepRatio) {
  let x1 = B.x,
    y1 = B.y,
    x2 = B.x + B.w,
    y2 = B.y + B.h;
  if (handle.includes("w")) x1 = wx;
  if (handle.includes("e")) x2 = wx;
  if (handle.includes("n")) y1 = wy;
  if (handle.includes("s")) y2 = wy;
  if (keepRatio && B.w > 0 && B.h > 0) {
    const r = B.w / B.h;
    if (handle.length === 2) {
      let w = x2 - x1,
        h = y2 - y1;
      if (Math.abs(w) / r > Math.abs(h)) h = (Math.sign(h) || 1) * (Math.abs(w) / r);
      else w = (Math.sign(w) || 1) * Math.abs(h) * r;
      if (handle.includes("w")) x1 = x2 - w;
      else x2 = x1 + w;
      if (handle.includes("n")) y1 = y2 - h;
      else y2 = y1 + h;
    } else if (handle === "e" || handle === "w") {
      const h = Math.abs(x2 - x1) / r,
        cy = B.y + B.h / 2;
      y1 = cy - h / 2;
      y2 = cy + h / 2;
    } else {
      const w = Math.abs(y2 - y1) * r,
        cx = B.x + B.w / 2;
      x1 = cx - w / 2;
      x2 = cx + w / 2;
    }
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * Partial erase: cut the part of a pen/highlighter stroke that lies within `r` of (cx, cy).
 * Returns the remaining pieces (0, 1 or more elements); the first keeps the original id.
 */
export function splitStroke(el, cx, cy, r) {
  const reach = r + (el.type === "hl" ? el.strokeWidth * 1.5 + 5 : el.strokeWidth / 2);
  // Densify long segments so the eraser can't slip between two far-apart points
  const step = Math.max(0.5, reach / 2);
  const pts = [];
  el.points.forEach((p, i) => {
    if (i) {
      const q = el.points[i - 1];
      const n = Math.floor(Math.hypot(p[0] - q[0], p[1] - q[1]) / step);
      for (let k = 1; k < n; k++) {
        const t = k / n;
        const ip = [q[0] + (p[0] - q[0]) * t, q[1] + (p[1] - q[1]) * t];
        if (p.length > 2) ip.push((q[2] ?? 0.5) + ((p[2] ?? 0.5) - (q[2] ?? 0.5)) * t);
        pts.push(ip);
      }
    }
    pts.push(p);
  });
  const pieces = [];
  let cur = [];
  for (const p of pts) {
    if (Math.hypot(p[0] - cx, p[1] - cy) <= reach) {
      if (cur.length) pieces.push(cur);
      cur = [];
    } else cur.push(p);
  }
  if (cur.length) pieces.push(cur);
  if (pieces.length === 1 && pieces[0].length === pts.length) return [el]; // nothing touched
  return pieces.filter((p) => p.length > 1).map((points, i) => ({ ...el, id: i ? uid() : el.id, points }));
}

/** Point-in-polygon (even–odd). poly: [[x, y], ...] */
export function inPolygon(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Is the element inside a lasso? Strokes: most of their points; boxes: their centre and most corners. */
export function inLasso(el, poly) {
  if (isPointType(el.type)) {
    const p = el.points;
    const stride = Math.max(1, Math.floor(p.length / 40));
    let n = 0,
      hit = 0;
    for (let i = 0; i < p.length; i += stride, n++) if (inPolygon(poly, p[i][0], p[i][1])) hit++;
    return hit / n >= 0.8;
  }
  const b = getBounds(el);
  if (!inPolygon(poly, b.x + b.w / 2, b.y + b.h / 2)) return false;
  const c = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]];
  return c.filter(([x, y]) => inPolygon(poly, x, y)).length >= 3;
}

/** Deep-ish clone with fresh ids, offset by d. */
export const cloneElements = (els, d = 0) => els.map((el) => translate({ ...el, id: uid() }, d, d));

/** Constrain (sx,sy)->(ex,ey) for shift: 45° for lines, square for boxes. */
export function constrain(type, sx, sy, ex, ey) {
  if (isLinear(type)) {
    const step = Math.PI / 4;
    const an = Math.round(Math.atan2(ey - sy, ex - sx) / step) * step;
    const d = Math.hypot(ex - sx, ey - sy);
    return [sx + d * Math.cos(an), sy + d * Math.sin(an)];
  }
  const d = Math.max(Math.abs(ex - sx), Math.abs(ey - sy));
  return [sx + (Math.sign(ex - sx) || 1) * d, sy + (Math.sign(ey - sy) || 1) * d];
}

/** Layer ordering. dir: 'front' | 'back' | 'forward' | 'backward' */
export function reorder(elements, ids, dir) {
  const sel = new Set(ids);
  if (dir === "front") return [...elements.filter((e) => !sel.has(e.id)), ...elements.filter((e) => sel.has(e.id))];
  if (dir === "back") return [...elements.filter((e) => sel.has(e.id)), ...elements.filter((e) => !sel.has(e.id))];
  const arr = [...elements];
  if (dir === "forward") {
    for (let i = arr.length - 2; i >= 0; i--)
      if (sel.has(arr[i].id) && !sel.has(arr[i + 1].id)) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
  } else {
    for (let i = 1; i < arr.length; i++)
      if (sel.has(arr[i].id) && !sel.has(arr[i - 1].id)) [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
  }
  return arr;
}

/** Align selection. kind: left|hcenter|right|top|vcenter|bottom */
export function align(elements, ids, kind) {
  const sel = new Set(ids);
  const U = unionBounds(elements.filter((e) => sel.has(e.id)));
  if (!U) return elements;
  return elements.map((el) => {
    if (!sel.has(el.id)) return el;
    const b = getBounds(el);
    let dx = 0,
      dy = 0;
    if (kind === "left") dx = U.x - b.x;
    if (kind === "right") dx = U.x + U.w - (b.x + b.w);
    if (kind === "hcenter") dx = U.x + U.w / 2 - (b.x + b.w / 2);
    if (kind === "top") dy = U.y - b.y;
    if (kind === "bottom") dy = U.y + U.h - (b.y + b.h);
    if (kind === "vcenter") dy = U.y + U.h / 2 - (b.y + b.h / 2);
    return dx || dy ? translate(el, dx, dy) : el;
  });
}
