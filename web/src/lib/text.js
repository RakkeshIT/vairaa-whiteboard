// Bullet / numbered point helpers. Points are real characters in the text,
// so what you see while typing is exactly what is drawn and exported.

export const BULLETS = ["•", "◦", "▪", "➤", "✓", "★", "–"];
const PREFIX = /^(\s*)(?:[•◦▪➤✓★–]|\d+[.)])\s/;

const prefixOf = (line) => (line.match(PREFIX)?.[0] ?? "").trim();
const isNum = (p) => /^\d+[.)]$/.test(p);

/**
 * Toggle a list style on every line. style: one of BULLETS, or "num" for 1. 2. 3.
 * If every non-empty line already uses that style, the points are removed instead.
 */
export function applyList(text, style) {
  const lines = (text || "").split("\n");
  const filled = lines.filter((l) => l.trim());
  const already =
    filled.length > 0 && filled.every((l) => (style === "num" ? isNum(prefixOf(l)) : prefixOf(l) === style));
  let n = 0;
  return lines
    .map((l) => {
      const body = l.replace(PREFIX, "$1");
      if (already) return body;
      if (!body.trim() && lines.length > 1) return body;
      const indent = body.match(/^\s*/)[0];
      return indent + (style === "num" ? `${++n}. ` : `${style} `) + body.trimStart();
    })
    .join("\n");
}

/** For Enter inside a point: what to insert next, or null when the line isn't a point. */
export function continueList(line) {
  const m = line.match(/^(\s*)(?:([•◦▪➤✓★–])|(\d+)([.)]))\s/);
  if (!m) return null;
  return {
    prefixLen: m[0].length,
    empty: !line.slice(m[0].length).trim(),
    next: m[2] ? `${m[1]}${m[2]} ` : `${m[1]}${Number(m[3]) + 1}${m[4]} `,
  };
}
