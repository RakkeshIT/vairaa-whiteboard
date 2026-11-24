// Tiny, safe math expression compiler for the graph plotter (no eval).
// Supports + - * / ^, implicit multiplication (2x, 3sin(x), (x+1)(x-1)), |x|, and common functions.

const FUNCS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  min: Math.min,
  max: Math.max,
};
const CONSTS = { pi: Math.PI, "π": Math.PI, e: Math.E };
// Longest names first so "sinh" wins over "sin" and "asin" over "a…"
const NAMES = [...Object.keys(FUNCS), ...Object.keys(CONSTS), "x"].sort((a, b) => b.length - a.length);

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
    if (num) {
      out.push({ t: "num", v: parseFloat(num[0]) });
      i += num[0].length;
      continue;
    }
    if (/[a-zπ]/i.test(c)) {
      const rest = src.slice(i).toLowerCase();
      const name = NAMES.find((n) => rest.startsWith(n));
      if (!name) throw new Error(`Unknown name "${/^[a-z]+/i.exec(src.slice(i))[0]}"`);
      out.push({ t: "name", v: name });
      i += name.length;
      continue;
    }
    if ("+-*/^(),|".includes(c)) {
      out.push({ t: c });
      i++;
      continue;
    }
    if (c === "×" || c === "·") {
      out.push({ t: "*" });
      i++;
      continue;
    }
    if (c === "÷") {
      out.push({ t: "/" });
      i++;
      continue;
    }
    throw new Error(`Unexpected "${c}"`);
  }
  return out;
}

/** Compile an expression in x. Returns (x) => number; throws Error with a readable message. */
export function compile(source) {
  const src = String(source || "")
    .replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=/i, "")
    .trim();
  if (!src) throw new Error("Type a function of x, e.g. x^2 - 3");
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const eat = (t) => {
    if (peek()?.t !== t) throw new Error(t === ")" ? "Missing )" : `Expected ${t}`);
    pos++;
  };

  const startsPrimary = (tk) => tk && (tk.t === "num" || tk.t === "name" || tk.t === "(");

  function expr() {
    let left = term();
    while (peek() && (peek().t === "+" || peek().t === "-")) {
      const op = toks[pos++].t,
        a = left,
        b = term();
      left = op === "+" ? (x) => a(x) + b(x) : (x) => a(x) - b(x);
    }
    return left;
  }
  function term() {
    let left = unary();
    for (;;) {
      const tk = peek();
      if (tk && (tk.t === "*" || tk.t === "/")) {
        pos++;
        const a = left,
          b = unary();
        left = tk.t === "*" ? (x) => a(x) * b(x) : (x) => a(x) / b(x);
      } else if (startsPrimary(tk)) {
        const a = left,
          b = power(); // implicit multiplication: 2x, 3sin(x), (x+1)(x-1)
        left = (x) => a(x) * b(x);
      } else return left;
    }
  }
  function unary() {
    if (peek()?.t === "-") {
      pos++;
      const a = unary();
      return (x) => -a(x);
    }
    if (peek()?.t === "+") {
      pos++;
      return unary();
    }
    return power();
  }
  function power() {
    const base = primary();
    if (peek()?.t === "^") {
      pos++;
      const ex = unary();
      return (x) => Math.pow(base(x), ex(x));
    }
    return base;
  }
  function primary() {
    const tk = toks[pos++];
    if (!tk) throw new Error("Expression ends too early");
    if (tk.t === "num") return () => tk.v;
    if (tk.t === "(") {
      const a = expr();
      eat(")");
      return a;
    }
    if (tk.t === "|") {
      const a = expr();
      eat("|");
      return (x) => Math.abs(a(x));
    }
    if (tk.t === "name") {
      if (tk.v === "x") return (x) => x;
      if (tk.v in CONSTS) return () => CONSTS[tk.v];
      const fn = FUNCS[tk.v];
      if (peek()?.t !== "(") {
        // sin x  →  sin(x) for a single following factor
        const arg = power();
        return (x) => fn(arg(x));
      }
      pos++;
      const args = [expr()];
      while (peek()?.t === ",") {
        pos++;
        args.push(expr());
      }
      eat(")");
      return args.length === 1 ? (x) => fn(args[0](x)) : (x) => fn(...args.map((a) => a(x)));
    }
    throw new Error(`Unexpected "${tk.t}"`);
  }

  const f = expr();
  if (pos < toks.length) throw new Error(`Unexpected "${toks[pos].t === "num" ? toks[pos].v : toks[pos].t}"`);
  return f;
}

const cache = new Map();
/** Cached compile that never throws: returns null for invalid input. */
export function compileSafe(source) {
  if (!cache.has(source)) {
    let f = null;
    try {
      f = compile(source);
    } catch {
      /* invalid → not plotted */
    }
    if (cache.size > 200) cache.clear();
    cache.set(source, f);
  }
  return cache.get(source);
}
