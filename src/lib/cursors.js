// Custom canvas pointers for the drawing tools, built as inline SVG cursors.
import { colorFor } from "./render";

export const POINTER_TOOLS = ["pen", "hl", "line", "arrow", "rect", "ellipse", "diamond"];
export const POINTERS = ["plus", "dot", "ring", "pencil", "arrow"];

const svgCursor = (svg, hx, hy, fallback = "crosshair") =>
  `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hx} ${hy}, ${fallback}`;
const wrap = (s, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${body}</svg>`;

/** Brush diameter on screen for the current tool, so dot/ring pointers preview the real stroke size. */
function brushPx(tool, sw, zoom) {
  const world = tool === "pen" ? sw * 1.5 + 1.5 : tool === "hl" ? sw * 3 + 10 : sw;
  return Math.max(4, Math.min(56, world * zoom));
}

export function pointerCSS({ kind, tool, stroke, strokeWidth, zoom, dark }) {
  const color = colorFor(stroke, dark);
  switch (kind) {
    case "arrow":
      return "default";
    case "dot":
    case "ring": {
      const d = brushPx(tool, strokeWidth, zoom);
      const s = Math.ceil(d + 6),
        c = s / 2,
        r = d / 2;
      const body =
        kind === "dot"
          ? `<circle cx="${c}" cy="${c}" r="${r + 1}" fill="#fff" fill-opacity="0.9"/><circle cx="${c}" cy="${c}" r="${r}" fill="${color}" fill-opacity="${tool === "hl" ? 0.5 : 1}"/>`
          : `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#fff" stroke-width="3"/><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="1.5"/><circle cx="${c}" cy="${c}" r="1" fill="${color}"/>`;
      return svgCursor(wrap(s, body), Math.round(c), Math.round(c));
    }
    case "pencil": {
      const p =
        "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z";
      const body = `<path d="${p}" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/><path d="M2.6 21.4l1.2-3.9 2.7 2.7z" fill="${color}"/><path d="m15 5 4 4" stroke="#111" stroke-width="1.5"/>`;
      return svgCursor(wrap(24, body), 2, 22);
    }
    default: {
      // plus: thin cross with a gap and a colour dot in the middle
      const arms = "M12 1v8M12 15v8M1 12h8M15 12h8";
      const body = `<path d="${arms}" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><path d="${arms}" stroke="${dark ? "#e9e9ee" : "#111"}" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="2" fill="${color}" stroke="#fff" stroke-width="0.8"/>`;
      return svgCursor(wrap(24, body), 12, 12);
    }
  }
}
