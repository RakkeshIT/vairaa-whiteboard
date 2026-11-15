// Math equations: elements store MathJax's SVG (rendered once when edited), so drawing is synchronous.
let engine = null;

/** TeX → { svg, ew, eh } | { error }. Loads MathJax on first use. */
export async function renderTex(tex) {
  engine ||= import("./mathjax.js");
  return (await engine).render(tex);
}

/** Size the element from its em size and font size. */
export const fitMath = (el) => ({ ...el, w: el.ew * el.fontSize, h: el.eh * el.fontSize });

// The SVG is rasterized at a fixed high resolution so it stays crisp when zoomed in.
const PX_PER_EM = 160;
const srcCache = new WeakMap();

/** data: URL for the element's SVG, coloured for the current board theme. */
export function mathSrc(el, color) {
  let byColor = srcCache.get(el);
  if (!byColor) srcCache.set(el, (byColor = new Map()));
  let src = byColor.get(color);
  if (!src) {
    const svg = (/^<svg[^>]*\sxmlns=/.test(el.svg) ? el.svg : el.svg.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"'))
      .replace(/\swidth="[^"]*"/, ` width="${(el.ew * PX_PER_EM).toFixed(1)}"`)
      .replace(/\sheight="[^"]*"/, ` height="${(el.eh * PX_PER_EM).toFixed(1)}"`)
      .replace(/currentColor/g, color);
    src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    byColor.set(color, src);
  }
  return src;
}
