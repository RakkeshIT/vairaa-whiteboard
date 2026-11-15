// Code blocks: Prism tokenizes, the canvas draws an editor-style card (header, line numbers, colours).
import Prism from "prismjs";
// Language plugins register on the global Prism and must load after their dependencies.
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-java";
import "prismjs/components/prism-kotlin";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-python";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-markup-templating";
import "prismjs/components/prism-php";
import "prismjs/components/prism-swift";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";

export const LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "jsx", label: "JSX / React" },
  { id: "tsx", label: "TSX" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "kotlin", label: "Kotlin" },
  { id: "swift", label: "Swift" },
  { id: "php", label: "PHP" },
  { id: "ruby", label: "Ruby" },
  { id: "sql", label: "SQL" },
  { id: "bash", label: "Shell / Bash" },
  { id: "markup", label: "HTML / XML" },
  { id: "css", label: "CSS" },
  { id: "json", label: "JSON" },
  { id: "yaml", label: "YAML" },
  { id: "plain", label: "Plain text" },
];
const LABEL = Object.fromEntries(LANGUAGES.map((l) => [l.id, l.label]));

export const CODE_THEMES = {
  dark: {
    bg: "#1e1e1e",
    header: "#2d2d30",
    border: "#3c3c3c",
    text: "#d4d4d4",
    lineNo: "#6e7681",
    label: "#9da5b4",
    tokens: {
      comment: "#6a9955",
      prolog: "#6a9955",
      keyword: "#569cd6",
      boolean: "#569cd6",
      important: "#569cd6",
      string: "#ce9178",
      char: "#ce9178",
      "attr-value": "#ce9178",
      template: "#ce9178",
      number: "#b5cea8",
      function: "#dcdcaa",
      "class-name": "#4ec9b0",
      builtin: "#4ec9b0",
      property: "#9cdcfe",
      variable: "#9cdcfe",
      parameter: "#9cdcfe",
      "attr-name": "#9cdcfe",
      tag: "#569cd6",
      selector: "#d7ba7d",
      regex: "#d16969",
      operator: "#d4d4d4",
      punctuation: "#d4d4d4",
      constant: "#4fc1ff",
      symbol: "#4fc1ff",
      decorator: "#dcdcaa",
      annotation: "#dcdcaa",
    },
  },
  light: {
    bg: "#f6f8fa",
    header: "#eaeef2",
    border: "#d0d7de",
    text: "#24292f",
    lineNo: "#8c959f",
    label: "#57606a",
    tokens: {
      comment: "#6e7781",
      prolog: "#6e7781",
      keyword: "#cf222e",
      boolean: "#0550ae",
      important: "#cf222e",
      string: "#0a3069",
      char: "#0a3069",
      "attr-value": "#0a3069",
      template: "#0a3069",
      number: "#0550ae",
      function: "#8250df",
      "class-name": "#953800",
      builtin: "#953800",
      property: "#0550ae",
      variable: "#953800",
      parameter: "#24292f",
      "attr-name": "#0550ae",
      tag: "#116329",
      selector: "#116329",
      regex: "#0a3069",
      operator: "#cf222e",
      punctuation: "#24292f",
      constant: "#0550ae",
      symbol: "#0550ae",
      decorator: "#8250df",
      annotation: "#8250df",
    },
  },
};

export const CODE_FONT = 'ui-monospace, "Cascadia Code", "JetBrains Mono", Consolas, monospace';
const LINE = 1.5; // line height, in font sizes
const PAD = 0.9; // inner padding, in font sizes
const HEADER = 2; // header bar height, in font sizes

/** Layout metrics for a code element (all world units). */
export function codeMetrics(el) {
  const f = el.fontSize;
  const lines = (el.code || "").split("\n").length;
  const gutter = el.lineNumbers === false ? 0 : (String(lines).length + 1.2) * f * 0.6;
  return { f, pad: PAD * f, header: HEADER * f, line: LINE * f, gutter };
}

const mctx = document.createElement("canvas").getContext("2d");
const detab = (s) => s.replace(/\t/g, "    ");

/** Size the card to fit its code (like fitText for text). */
export function fitCode(el) {
  const m = codeMetrics(el);
  mctx.font = `${m.f}px ${CODE_FONT}`;
  const lines = detab(el.code || "").split("\n");
  const textW = Math.max(m.f * 12, ...lines.map((l) => mctx.measureText(l).width));
  return {
    ...el,
    w: Math.ceil(m.pad * 2 + m.gutter + textW),
    h: Math.ceil(m.header + m.pad * 2 + lines.length * m.line),
  };
}

/** Flatten Prism's token tree into lines of { text, type } runs. */
function tokenLines(code, language) {
  const grammar = Prism.languages[language];
  const out = [[]];
  const push = (text, type) => {
    const parts = text.split("\n");
    parts.forEach((p, i) => {
      if (i > 0) out.push([]);
      if (p) out[out.length - 1].push({ text: p, type });
    });
  };
  const walk = (tokens, inherited) => {
    for (const t of tokens) {
      if (typeof t === "string") push(t, inherited);
      else {
        const alias = Array.isArray(t.alias) ? t.alias[0] : t.alias;
        const type = t.type in CODE_THEMES.dark.tokens ? t.type : alias || inherited || t.type;
        if (Array.isArray(t.content)) walk(t.content, type);
        else if (typeof t.content === "string") push(t.content, type);
        else walk([t.content], type);
      }
    }
  };
  const src = detab(code || "");
  walk(grammar ? Prism.tokenize(src, grammar) : [src], null);
  return out;
}

// Elements are immutable, so tokenization is cached per element object.
const tokenCache = new WeakMap();
function linesOf(el) {
  let hit = tokenCache.get(el);
  if (!hit) {
    hit = tokenLines(el.code, el.language);
    tokenCache.set(el, hit);
  }
  return hit;
}

const colorOf = (theme, type) => (type && theme.tokens[type]) || theme.text;

/** Draw a code card in world space (ctx carries the camera transform). */
export function drawCode(ctx, el, b, { hideText = false } = {}) {
  const theme = CODE_THEMES[el.theme] || CODE_THEMES.dark;
  const m = codeMetrics(el);
  const r = Math.min(m.f * 0.6, 12);

  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = theme.bg;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, r);
  else ctx.rect(b.x, b.y, b.w, b.h);
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.save();
  ctx.clip();
  // header bar: window dots + language label
  ctx.fillStyle = theme.header;
  ctx.fillRect(b.x, b.y, b.w, m.header);
  ctx.fillStyle = theme.border;
  ctx.fillRect(b.x, b.y + m.header - 1, b.w, 1);
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(b.x + m.pad + i * m.f * 0.95, b.y + m.header / 2, m.f * 0.27, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.font = `600 ${m.f * 0.72}px ${CODE_FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillStyle = theme.label;
  ctx.fillText(LABEL[el.language] || el.language, b.x + b.w - m.pad, b.y + m.header / 2);
  ctx.textAlign = "left";

  if (!hideText) {
    ctx.font = `${m.f}px ${CODE_FONT}`;
    // Show code exactly as typed: no "<=" → "≤" style font ligatures
    ctx.textRendering = "optimizeSpeed";
    ctx.textBaseline = "top";
    const top = b.y + m.header + m.pad + (m.line - m.f) / 2;
    linesOf(el).forEach((runs, i) => {
      const y = top + i * m.line;
      if (el.lineNumbers !== false) {
        ctx.fillStyle = theme.lineNo;
        ctx.textAlign = "right";
        ctx.fillText(String(i + 1), b.x + m.pad + m.gutter - m.f * 0.9, y);
        ctx.textAlign = "left";
      }
      let x = b.x + m.pad + m.gutter;
      for (const run of runs) {
        ctx.fillStyle = colorOf(theme, run.type);
        ctx.fillText(run.text, x, y);
        x += ctx.measureText(run.text).width;
      }
    });
  }
  ctx.restore();
}

/** SVG markup for a code card (vector export). */
export function codeToSVG(el, b, esc) {
  const theme = CODE_THEMES[el.theme] || CODE_THEMES.dark;
  const m = codeMetrics(el);
  const op = el.opacity ?? 1;
  const r = Math.min(m.f * 0.6, 12);
  const parts = [
    `<g opacity="${op}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${r}" fill="${theme.bg}"/>`,
    `<path d="M${b.x} ${b.y + m.header}V${b.y + r}a${r} ${r} 0 0 1 ${r}-${r}H${b.x + b.w - r}a${r} ${r} 0 0 1 ${r} ${r}V${b.y + m.header}Z" fill="${theme.header}"/>`,
  ];
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) =>
    parts.push(`<circle cx="${b.x + m.pad + i * m.f * 0.95}" cy="${b.y + m.header / 2}" r="${m.f * 0.27}" fill="${c}"/>`),
  );
  parts.push(
    `<text x="${b.x + b.w - m.pad}" y="${b.y + m.header / 2}" text-anchor="end" dominant-baseline="central" font-family='${CODE_FONT}' font-weight="600" font-size="${m.f * 0.72}" fill="${theme.label}">${esc(LABEL[el.language] || el.language)}</text>`,
  );
  const top = b.y + m.header + m.pad + (m.line - m.f) / 2;
  linesOf(el).forEach((runs, i) => {
    const y = top + i * m.line;
    if (el.lineNumbers !== false)
      parts.push(
        `<text x="${b.x + m.pad + m.gutter - m.f * 0.9}" y="${y}" text-anchor="end" dominant-baseline="hanging" font-family='${CODE_FONT}' font-size="${m.f}" fill="${theme.lineNo}">${i + 1}</text>`,
      );
    if (runs.length)
      parts.push(
        `<text x="${b.x + m.pad + m.gutter}" y="${y}" dominant-baseline="hanging" font-family='${CODE_FONT}' font-size="${m.f}" style="font-variant-ligatures:none" xml:space="preserve">${runs
          .map((run) => `<tspan fill="${colorOf(theme, run.type)}">${esc(run.text)}</tspan>`)
          .join("")}</text>`,
      );
  });
  parts.push("</g>");
  return parts.join("");
}
