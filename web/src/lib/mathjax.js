// MathJax engine (TeX → self-contained SVG). Heavy: only ever loaded through lib/math.js's dynamic import.
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { MathJaxNewcmFont } from "@mathjax/mathjax-newcm-font/js/svg.js";
import { MathJaxMhchemFontExtension } from "@mathjax/mathjax-mhchem-font-extension/js/svg.js";
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js";
import "@mathjax/src/js/input/tex/noundefined/NoUndefinedConfiguration.js";
import "@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js";
import "@mathjax/src/js/input/tex/cancel/CancelConfiguration.js";
import "@mathjax/src/js/input/tex/color/ColorConfiguration.js";
import "@mathjax/src/js/input/tex/braket/BraketConfiguration.js";
import "@mathjax/src/js/input/tex/cases/CasesConfiguration.js";
import "@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js";

// Rarely used glyph ranges are split into separate font files that MathJax requests on demand.
const fontFiles = import.meta.glob("/node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic/*.js");
mathjax.asyncLoad = (name) => {
  const file = name.split("/").pop();
  const load = fontFiles[`/node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic/${file}`];
  return load ? load() : Promise.reject(new Error(`Unknown MathJax font file: ${file}`));
};

// Glyphs for chemistry reaction arrows (\ce{A -> B})
MathJaxNewcmFont.addExtension(MathJaxMhchemFontExtension);

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document("", {
  InputJax: new TeX({
    packages: ["base", "ams", "newcommand", "noundefined", "boldsymbol", "cancel", "color", "braket", "cases", "mhchem"],
  }),
  OutputJax: new SVG({ fontData: MathJaxNewcmFont, fontCache: "none" }),
});

/**
 * Render TeX to SVG markup that uses currentColor.
 * Returns { svg, ew, eh } (size in ems) or { error } for invalid TeX.
 */
export async function render(tex) {
  const node = await doc.convertPromise(tex, { display: true });
  const svg = adaptor.innerHTML(node);
  const err = /data-mjx-error="([^"]*)"/.exec(svg);
  if (err) return { error: err[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&") };
  const vb = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!vb) return { error: "Could not render this equation" };
  return { svg, ew: +vb[3] / 1000, eh: +vb[4] / 1000 };
}
