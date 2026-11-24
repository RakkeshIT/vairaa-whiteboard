// Quick shapes: draw a rough line / box / circle / diamond, hold still, and it snaps to a clean shape.
import { distToSeg } from "./elements";

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function pathLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
  return L;
}

/** Ramer–Douglas–Peucker simplification (iterative, keeps endpoints). */
function simplify(pts, eps) {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let best = -1,
      bi = -1;
    for (let i = s + 1; i < e; i++) {
      const d = distToSeg(pts[i][0], pts[i][1], pts[s][0], pts[s][1], pts[e][0], pts[e][1]);
      if (d > best) (best = d), (bi = i);
    }
    if (best > eps) {
      keep[bi] = 1;
      stack.push([s, bi], [bi, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Corners of a closed polyline: drop the closing duplicate and nearly-straight vertices. */
function corners(pts, eps) {
  let v = simplify(pts, eps);
  if (v.length > 2 && dist(v[0], v[v.length - 1]) < eps * 2) v = v.slice(0, -1);
  for (let changed = true; changed && v.length > 3; ) {
    changed = false;
    for (let i = 0; i < v.length; i++) {
      const a = v[(i - 1 + v.length) % v.length],
        b = v[i],
        c = v[(i + 1) % v.length];
      const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]),
        a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      let turn = Math.abs(a2 - a1);
      if (turn > Math.PI) turn = 2 * Math.PI - turn;
      if (turn < 0.45 || dist(a, b) < eps || dist(b, c) < eps) {
        v.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return v;
}

/**
 * Recognise a freehand stroke. Returns
 *   { type: "line", points: [[x, y], [x, y]] }  or  { type: "rect" | "ellipse" | "diamond", x, y, w, h }
 * or null when the stroke doesn't look like any of them.
 */
export function recognize(points) {
  const pts = points.map((p) => [p[0], p[1]]);
  if (pts.length < 4) return null;
  let x1 = Infinity,
    y1 = Infinity,
    x2 = -Infinity,
    y2 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x1) x1 = x;
    if (y < y1) y1 = y;
    if (x > x2) x2 = x;
    if (y > y2) y2 = y;
  }
  const w = x2 - x1,
    h = y2 - y1,
    diag = Math.hypot(w, h);
  if (diag < 16) return null;

  const first = pts[0],
    last = pts[pts.length - 1];
  const L = pathLength(pts),
    chord = dist(first, last);

  // Straight line: the path barely deviates from the first→last chord.
  if (chord / L > 0.92) {
    let dev = 0;
    for (const p of pts) dev = Math.max(dev, distToSeg(p[0], p[1], first[0], first[1], last[0], last[1]));
    if (dev <= Math.max(5, chord * 0.07)) return { type: "line", points: [first, last] };
    return null;
  }

  // Closed shapes: ends meet and the path goes most of the way around.
  if (chord > diag * 0.3 || L < diag * 1.5 || Math.min(w, h) < 10) return null;
  const box = { x: x1, y: y1, w, h };
  const v = corners(pts, diag * 0.07);
  const tol = diag * 0.2;
  if (v.length === 4) {
    const boxCorners = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
    const mids = [[(x1 + x2) / 2, y1], [x2, (y1 + y2) / 2], [(x1 + x2) / 2, y2], [x1, (y1 + y2) / 2]];
    const near = (targets) => v.every((p) => targets.some((t) => dist(p, t) < tol));
    if (near(boxCorners)) return { type: "rect", ...box };
    if (near(mids)) return { type: "diamond", ...box };
  }
  // Ellipse: points sit close to the ellipse inscribed in the bounding box.
  const cx = x1 + w / 2,
    cy = y1 + h / 2;
  let err = 0;
  for (const [x, y] of pts) err += Math.abs(Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2)) - 1);
  if (err / pts.length < 0.13 && v.length !== 3) return { type: "ellipse", ...box };
  return null;
}
