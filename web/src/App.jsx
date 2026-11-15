import { useEffect, useMemo, useRef, useState } from "react";
import { Palette, HelpCircle, ImageDown, X, User as UserIcon } from "lucide-react";
import Toolbar from "./components/Toolbar";
import PropsPanel from "./components/PropsPanel";
import TopMenu from "./components/TopMenu";
import { ZoomControls, PageTabs } from "./components/BottomBar";
import HelpModal from "./components/HelpModal";
import AuthModal from "./components/AuthModal";
import { authClient, whiteboardApi } from "./lib/api";
import * as G from "./lib/elements";
import {
  drawElement,
  drawBackground,
  drawSelectionUI,
  getHandles,
  setAssetListener,
  fitText,
  colorFor,
  renderToCanvas,
  renderToSVG,
  FONTS,
  LINE_HEIGHT,
  STICKY_PAD,
  INK,
} from "./lib/render";
import * as Store from "./lib/storage";
import { pointerCSS, stampCursor, POINTER_TOOLS, POINTERS } from "./lib/cursors";
import * as Text from "./lib/text";

const DRAW_TOOLS = ["pen", "hl", "eraser", "line", "arrow", "rect", "ellipse", "diamond", "text", "sticky", "stamp"];
const DEFAULT_STYLE = {
  stroke: INK,
  fill: "transparent",
  stickyFill: "#fef08a",
  strokeWidth: 4,
  strokeStyle: "solid",
  opacity: 1,
  font: "hand",
  fontSize: 36,
  pointer: "plus",
  bold: false,
  italic: false,
  underline: false,
  stampKind: "emoji",
  stamp: "😀",
  stampSize: 56,
};
const TEXT_TYPES = ["text", "sticky"];
const FMT_KEYS = ["bold", "italic", "underline"];
const HANDLE_CURSOR = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  p0: "move",
  p1: "move",
};
const KEYMAP = {
  v: "select",
  h: "hand",
  p: "pen",
  m: "hl",
  e: "eraser",
  k: "laser",
  l: "line",
  a: "arrow",
  r: "rect",
  o: "ellipse",
  c: "ellipse",
  d: "diamond",
  t: "text",
  n: "sticky",
  s: "stamp",
  i: "image",
};
const SNAP = 12;
const LASER_MS = 900;
const CLIP_PREFIX = "pro-whiteboard/elements:";
const clampZ = (z) => Math.min(8, Math.max(0.1, z));
const isTyping = (t) => t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

export default function App() {
  const canvasRef = useRef(null);
  const taRef = useRef(null);
  const fileImg = useRef(null);
  const fileDoc = useRef(null);

  const [doc, setDoc] = useState(() => Store.loadDoc() || Store.newDoc());
  const [tool, setToolState] = useState("pen");
  const [style, setStyle] = useState(() => ({ ...DEFAULT_STYLE, ...Store.loadStyle() }));
  const [selected, setSelected] = useState([]);
  const [cam, setCamState] = useState({ x: 0, y: 0, z: 1 });
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);
  const [help, setHelp] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 768);
  const [, setHistTick] = useState(0);

  // Per-user authentication & cloud whiteboard sync states
  // Session lives in an httpOnly cookie; useSession restores it on refresh and reacts to sign-in/out
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const user = session?.user ?? null;
  const [authOpen, setAuthOpen] = useState(false);
  const [cloudStatus, setCloudStatus] = useState("synced");
  const [currentBoardId, setCurrentBoardId] = useState(null);

  const page = doc.pages.find((p) => p.id === doc.current) || doc.pages[0];
  const elements = page.elements;

  // Latest state for event handlers (pointer/keyboard handlers run outside React's render cycle).
  const R = useRef(null);
  R.current = { doc, page, elements, tool, style, selected, editing };

  const camRef = useRef(cam);
  const I = useRef({ mode: "idle" }); // current interaction
  const draft = useRef(null); // element being drawn
  const marquee = useRef(null);
  const erased = useRef(new Set());
  const laser = useRef([]);
  const laserStroke = useRef(0);
  const hover = useRef(null);
  const pointers = useRef(new Map());
  const spaceDown = useRef(false);
  const dirty = useRef(true);
  const hist = useRef({});
  const pageCams = useRef({});
  const clipboard = useRef(null);
  const editBefore = useRef(null);
  const liveBefore = useRef(null);
  const toastTimer = useRef(null);
  const storageWarned = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const remoteDoc = useRef(null); // doc that came from storage — don't echo it back
  const pendingSave = useRef(null);
  const stampReturn = useRef(null); // tool to go back to after a quick stamp from the pen

  // ---------------------------------------------------------------- helpers
  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };
  const toWorld = (sx, sy) => {
    const c = camRef.current;
    return [(sx - c.x) / c.z, (sy - c.y) / c.z];
  };
  const setCam = (c) => {
    camRef.current = c;
    setCamState(c);
    dirty.current = true;
  };
  const setSel = (ids) => {
    R.current.selected = ids;
    setSelected(ids);
    dirty.current = true;
  };
  const H = () => (hist.current[R.current.page.id] ||= { past: [], future: [] });

  /** Replace current page elements without recording history (used during drags). */
  const setLive = (next) => {
    R.current.elements = next;
    dirty.current = true;
    setDoc((d) => ({ ...d, pages: d.pages.map((p) => (p.id === d.current ? { ...p, elements: next } : p)) }));
  };
  /** Replace elements and record an undo step. */
  const commit = (next, before = R.current.elements) => {
    if (next === before) return;
    const h = H();
    h.past.push(before);
    if (h.past.length > 200) h.past.shift();
    h.future = [];
    setLive(next);
    setHistTick((t) => t + 1);
  };
  const snapV = (v) => (R.current.doc.snap ? Math.round(v / SNAP) * SNAP : v);

  const topHit = (wx, wy, types) => {
    const r = R.current,
      tol = 6 / camRef.current.z;
    for (let i = r.elements.length - 1; i >= 0; i--) {
      const el = r.elements[i];
      if (types && !types.includes(el.type)) continue;
      if (G.hitTest(el, wx, wy, tol)) return el;
    }
    return null;
  };

  // ---------------------------------------------------------------- camera
  const zoomAt = (sx, sy, z) => {
    const c = camRef.current;
    const nz = clampZ(z);
    setCam({ z: nz, x: sx - ((sx - c.x) * nz) / c.z, y: sy - ((sy - c.y) * nz) / c.z });
  };
  const fitTo = (els) => {
    const b = G.unionBounds(els);
    const W = window.innerWidth,
      Hh = window.innerHeight;
    if (!b) return setCam({ x: 0, y: 0, z: 1 });
    const z = clampZ(Math.min((W - 160) / Math.max(b.w, 1), (Hh - 200) / Math.max(b.h, 1), 2));
    setCam({ z, x: W / 2 - (b.x + b.w / 2) * z, y: Hh / 2 - (b.y + b.h / 2) * z });
  };
  const zoomCmd = (kind) => {
    const cx = window.innerWidth / 2,
      cy = window.innerHeight / 2,
      z = camRef.current.z;
    if (kind === "in") zoomAt(cx, cy, z * 1.2);
    if (kind === "out") zoomAt(cx, cy, z / 1.2);
    if (kind === "reset") zoomAt(cx, cy, 1);
    if (kind === "fit") fitTo(R.current.elements);
  };

  // ---------------------------------------------------------------- tools
  const setTool = (t) => {
    if (t === "image") return fileImg.current?.click();
    stampReturn.current = null;
    finishEdit();
    setToolState(t);
    R.current.tool = t;
    if (t !== "select") setSel([]);
  };

  // ---------------------------------------------------------------- text editing
  const startEdit = (id, before = R.current.elements) => {
    editBefore.current = before;
    R.current.editing = id;
    setEditing(id);
    setSel([]);
  };
  const finishEdit = () => {
    const id = R.current.editing;
    if (!id) return;
    R.current.editing = null;
    setEditing(null);
    const before = editBefore.current || R.current.elements;
    editBefore.current = null;
    const els = R.current.elements;
    const el = els.find((e) => e.id === id);
    const prev = before.find((e) => e.id === id);
    const empty = el && el.type === "text" && !el.text.trim();
    if (!prev && (!el || empty)) return setLive(before); // new, empty text → discard silently
    if (empty) return commit(els.filter((e) => e.id !== id), before); // existing text cleared → delete
    if (!prev || prev !== el) commit(els, before); // text or formatting changed
  };
  const createText = (wx, wy, text = "") => {
    const st = R.current.style;
    const el = fitText({
      id: G.uid(),
      type: "text",
      x: wx,
      y: wy - st.fontSize * 0.6,
      w: 0,
      h: 0,
      text,
      stroke: st.stroke,
      strokeWidth: 1,
      opacity: st.opacity,
      font: st.font,
      fontSize: st.fontSize,
      bold: st.bold,
      italic: st.italic,
      underline: st.underline,
    });
    const before = R.current.elements;
    setLive([...before, el]);
    return { el, before };
  };
  const onEditText = (v) => {
    const id = R.current.editing;
    setLive(R.current.elements.map((el) => (el.id === id ? fitText({ ...el, text: v }) : el)));
  };

  // ---------------------------------------------------------------- erase / pinch
  const eraseAlong = (x0, y0, x1, y1) => {
    const z = camRef.current.z;
    const rad = (6 + R.current.style.strokeWidth * 1.5) / z;
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (rad * 0.5)) + 1;
    const set = erased.current;
    for (let s = 0; s <= steps; s++) {
      const px = x0 + ((x1 - x0) * s) / steps,
        py = y0 + ((y1 - y0) * s) / steps;
      for (const el of R.current.elements) if (!set.has(el.id) && G.hitTest(el, px, py, rad)) set.add(el.id);
    }
  };
  const beginPinch = () => {
    const m = I.current;
    if (m.before && m.moved) setLive(m.before);
    draft.current = null;
    marquee.current = null;
    erased.current = new Set();
    const [a, b] = [...pointers.current.values()];
    I.current = {
      mode: "pinch",
      d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      cam0: camRef.current,
    };
  };
  const updatePinch = () => {
    const m = I.current;
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return;
    const z = clampZ((m.cam0.z * Math.hypot(a.x - b.x, a.y - b.y)) / m.d0);
    const wx = (m.m0.x - m.cam0.x) / m.cam0.z,
      wy = (m.m0.y - m.cam0.y) / m.cam0.z;
    setCam({ z, x: (a.x + b.x) / 2 - wx * z, y: (a.y + b.y) / 2 - wy * z });
  };

  // ---------------------------------------------------------------- pointer handlers
  const selectDown = (e, wx, wy) => {
    const r = R.current;
    const selEls = r.elements.filter((el) => r.selected.includes(el.id));
    const h = getHandles(selEls, camRef.current).find(
      (h) => Math.abs(h.x - e.clientX) <= 9 && Math.abs(h.y - e.clientY) <= 9,
    );
    if (h) {
      I.current =
        h.id[0] === "p"
          ? { mode: "endpoint", idx: +h.id[1], id: selEls[0].id, orig: r.elements, before: r.elements }
          : {
              mode: "resize",
              handle: h.id,
              orig: r.elements,
              before: r.elements,
              B: G.unionBounds(selEls),
              ids: new Set(r.selected),
              keep: selEls.some((el) => el.type === "text" || el.type === "image" || el.type === "stamp"),
            };
      return;
    }
    const hit = topHit(wx, wy);
    let sel = r.selected;
    if (hit) {
      if (e.shiftKey) {
        sel = sel.includes(hit.id) ? sel.filter((i) => i !== hit.id) : [...sel, hit.id];
        setSel(sel);
        if (!sel.includes(hit.id)) return;
      } else if (!sel.includes(hit.id)) {
        sel = [hit.id];
        setSel(sel);
      }
    } else {
      const U = G.unionBounds(selEls);
      if (!U || e.shiftKey || !G.inBounds(U, wx, wy, 5 / camRef.current.z)) {
        const base = e.shiftKey ? sel : [];
        if (!e.shiftKey) setSel([]);
        I.current = { mode: "marquee", sx: wx, sy: wy, base };
        return;
      }
    }
    let orig = r.elements,
      ids = new Set(sel);
    if (e.altKey) {
      const clones = G.cloneElements(orig.filter((el) => ids.has(el.id)));
      orig = [...orig, ...clones];
      ids = new Set(clones.map((c) => c.id));
      setLive(orig);
      setSel([...ids]);
    }
    I.current = {
      mode: "move",
      sx: wx,
      sy: wy,
      orig,
      before: r.elements,
      ids,
      B: G.unionBounds(orig.filter((el) => ids.has(el.id))),
      moved: e.altKey,
      hitId: hit?.id,
      shift: e.shiftKey,
    };
  };

  const onPointerDown = (e) => {
    const cv = canvasRef.current;
    e.preventDefault(); // keeps focus where it is (text editor) and blocks mouse-compat events
    try {
      cv.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) return beginPinch();
    if (pointers.current.size > 2) return;
    if (R.current.editing) {
      finishEdit();
      return;
    }
    const r = R.current;
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    if (e.button === 1 || spaceDown.current || r.tool === "hand") {
      I.current = { mode: "pan", sx: e.clientX, sy: e.clientY, cam0: camRef.current };
      cv.style.cursor = "grabbing";
      return;
    }
    if (e.button !== 0) return;
    const st = r.style;
    const base = {
      id: G.uid(),
      stroke: st.stroke,
      strokeWidth: st.strokeWidth,
      strokeStyle: st.strokeStyle,
      opacity: st.opacity,
    };
    const sx = snapV(wx),
      sy = snapV(wy);
    switch (r.tool) {
      case "select":
        selectDown(e, wx, wy);
        break;
      case "pen":
      case "hl":
        draft.current = {
          ...base,
          type: r.tool,
          strokeStyle: "solid",
          pressure: e.pointerType === "pen",
          points: [[wx, wy, e.pressure || 0.5]],
        };
        I.current = { mode: "draw" };
        break;
      case "line":
      case "arrow":
        draft.current = { ...base, type: r.tool, points: [[sx, sy], [sx, sy]] };
        I.current = { mode: "create", sx, sy };
        break;
      case "rect":
      case "ellipse":
      case "diamond":
        draft.current = { ...base, type: r.tool, fill: st.fill, x: sx, y: sy, w: 0, h: 0 };
        I.current = { mode: "create", sx, sy };
        break;
      case "text": {
        const hit = topHit(wx, wy, ["text", "sticky"]);
        if (hit) startEdit(hit.id);
        else {
          const { el, before } = createText(wx, wy);
          startEdit(el.id, before);
        }
        break;
      }
      case "sticky": {
        const el = {
          ...base,
          type: "sticky",
          x: snapV(wx - 100),
          y: snapV(wy - 100),
          w: 200,
          h: 200,
          fill: st.stickyFill,
          text: "",
          stroke: INK,
          strokeWidth: 1,
          font: st.font,
          fontSize: Math.min(st.fontSize, 36),
          bold: st.bold,
          italic: st.italic,
          underline: st.underline,
        };
        const before = r.elements;
        setLive([...before, el]);
        startEdit(el.id, before);
        break;
      }
      case "stamp": {
        const size = st.stampSize;
        const value =
          st.stampKind === "number"
            ? String(
                1 +
                  Math.max(
                    0,
                    ...r.elements.filter((x) => x.type === "stamp" && x.kind === "number").map((x) => +x.value || 0),
                  ),
              )
            : st.stamp;
        const el = {
          ...base,
          type: "stamp",
          kind: st.stampKind,
          value,
          x: snapV(wx - size / 2),
          y: snapV(wy - size / 2),
          w: size,
          h: size,
          strokeWidth: 1,
        };
        commit([...r.elements, el]);
        if (stampReturn.current) setTool(stampReturn.current); // quick stamp from the pen → back to drawing
        break;
      }
      case "eraser":
        erased.current = new Set();
        I.current = { mode: "erase", last: [wx, wy] };
        eraseAlong(wx, wy, wx, wy);
        break;
      case "laser":
        laserStroke.current++;
        laser.current.push({ x: wx, y: wy, t: performance.now(), s: laserStroke.current });
        I.current = { mode: "laser" };
        break;
    }
    dirty.current = true;
  };

  const updateCursor = (e, wx, wy) => {
    const cv = canvasRef.current,
      r = R.current;
    if (spaceDown.current || r.tool === "hand") return void (cv.style.cursor = "grab");
    if (r.tool === "select") {
      const selEls = r.elements.filter((el) => r.selected.includes(el.id));
      const h = getHandles(selEls, camRef.current).find(
        (h) => Math.abs(h.x - e.clientX) <= 9 && Math.abs(h.y - e.clientY) <= 9,
      );
      cv.style.cursor = h ? HANDLE_CURSOR[h.id] : topHit(wx, wy) ? "move" : "default";
      return;
    }
    cv.style.cursor = toolCursor();
  };
  /** Cursor for the active tool; drawing tools use the pointer style picked in the panel. */
  const toolCursor = () => {
    const r = R.current;
    if (r.tool === "hand") return "grab";
    if (r.tool === "select") return "default";
    if (r.tool === "text") return "text";
    if (r.tool === "eraser") return "none";
    if (r.tool === "stamp") return stampCursor(r.style, r.doc.dark);
    if (!POINTER_TOOLS.includes(r.tool)) return "crosshair";
    return pointerCSS({
      kind: r.style.pointer,
      tool: r.tool,
      stroke: r.style.stroke,
      strokeWidth: r.style.strokeWidth,
      zoom: camRef.current.z,
      dark: r.doc.dark,
    });
  };

  const onPointerMove = (e) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const m = I.current;
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    hover.current = [wx, wy];
    if (m.mode === "pinch") return updatePinch();
    if (m.mode === "idle") {
      if (e.pointerType !== "touch") updateCursor(e, wx, wy);
      if (R.current.tool === "eraser") dirty.current = true;
      return;
    }
    const r = R.current,
      z = camRef.current.z;
    switch (m.mode) {
      case "pan":
        setCam({ ...m.cam0, x: m.cam0.x + e.clientX - m.sx, y: m.cam0.y + e.clientY - m.sy });
        break;
      case "draw": {
        const evs = e.getCoalescedEvents?.() || [];
        for (const v of evs.length ? evs : [e]) {
          const [x, y] = toWorld(v.clientX, v.clientY);
          draft.current.points.push([x, y, v.pressure || 0.5]);
        }
        break;
      }
      case "create": {
        const d = draft.current;
        let ex = snapV(wx),
          ey = snapV(wy);
        if (e.shiftKey) [ex, ey] = G.constrain(d.type, m.sx, m.sy, ex, ey);
        draft.current = G.isLinear(d.type)
          ? { ...d, points: [[m.sx, m.sy], [ex, ey]] }
          : { ...d, w: ex - m.sx, h: ey - m.sy };
        break;
      }
      case "move": {
        if (!m.moved && Math.hypot(wx - m.sx, wy - m.sy) * z < 3) return;
        m.moved = true;
        let dx = wx - m.sx,
          dy = wy - m.sy;
        if (e.shiftKey) Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0);
        if (r.doc.snap) {
          dx = snapV(m.B.x + dx) - m.B.x;
          dy = snapV(m.B.y + dy) - m.B.y;
        }
        setLive(m.orig.map((el) => (m.ids.has(el.id) ? G.translate(el, dx, dy) : el)));
        break;
      }
      case "resize": {
        m.moved = true;
        const keep = m.keep ? !e.shiftKey : e.shiftKey;
        const N = G.resizeBounds(m.B, m.handle, snapV(wx), snapV(wy), keep);
        const axis = m.handle === "e" || m.handle === "w" ? "x" : "y";
        setLive(m.orig.map((el) => (m.ids.has(el.id) ? fitText(G.scaleElement(el, m.B, N, axis)) : el)));
        break;
      }
      case "endpoint": {
        m.moved = true;
        let px = snapV(wx),
          py = snapV(wy);
        const el0 = m.orig.find((el) => el.id === m.id);
        const other = el0.points[1 - m.idx];
        if (e.shiftKey) [px, py] = G.constrain("line", other[0], other[1], px, py);
        setLive(
          m.orig.map((el) =>
            el.id === m.id ? { ...el, points: el.points.map((p, i) => (i === m.idx ? [px, py] : p)) } : el,
          ),
        );
        break;
      }
      case "marquee": {
        const box = {
          x: Math.min(m.sx, wx),
          y: Math.min(m.sy, wy),
          w: Math.abs(wx - m.sx),
          h: Math.abs(wy - m.sy),
        };
        marquee.current = box;
        const ids = r.elements.filter((el) => G.intersects(G.getBounds(el), box)).map((el) => el.id);
        const next = [...new Set([...m.base, ...ids])];
        if (next.length !== r.selected.length || next.some((id, i) => id !== r.selected[i])) setSel(next);
        break;
      }
      case "erase":
        eraseAlong(m.last[0], m.last[1], wx, wy);
        m.last = [wx, wy];
        break;
      case "laser":
        laser.current.push({ x: wx, y: wy, t: performance.now(), s: laserStroke.current });
        break;
    }
    dirty.current = true;
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    const m = I.current;
    if (m.mode === "pinch") {
      if (pointers.current.size === 0) I.current = { mode: "idle" };
      return;
    }
    I.current = { mode: "idle" };
    const r = R.current,
      z = camRef.current.z;
    switch (m.mode) {
      case "pan":
        updateCursor(e, ...toWorld(e.clientX, e.clientY));
        break;
      case "draw": {
        const d = draft.current;
        draft.current = null;
        if (d) commit([...r.elements, d]);
        break;
      }
      case "create": {
        const d = draft.current;
        draft.current = null;
        if (!d) break;
        const big = G.isLinear(d.type)
          ? Math.hypot(d.points[1][0] - d.points[0][0], d.points[1][1] - d.points[0][1]) * z > 4
          : Math.abs(d.w) * z > 4 && Math.abs(d.h) * z > 4;
        if (big) commit([...r.elements, G.normalize(d)]);
        break;
      }
      case "move":
        if (m.moved) commit(r.elements, m.before);
        else if (!m.shift && m.hitId && r.selected.length > 1) setSel([m.hitId]);
        break;
      case "resize":
      case "endpoint":
        if (m.moved) commit(r.elements, m.before);
        break;
      case "marquee":
        marquee.current = null;
        break;
      case "erase": {
        const ids = erased.current;
        erased.current = new Set();
        if (ids.size) commit(r.elements.filter((el) => !ids.has(el.id)));
        break;
      }
    }
    dirty.current = true;
  };

  const onDoubleClick = (e) => {
    if (R.current.tool !== "select") return;
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    const hit = topHit(wx, wy, ["text", "sticky"]);
    if (hit) return startEdit(hit.id);
    if (!topHit(wx, wy)) {
      const { el, before } = createText(wx, wy);
      startEdit(el.id, before);
    }
  };

  // ---------------------------------------------------------------- commands
  const selEls = useMemo(() => {
    const s = new Set(selected);
    return elements.filter((el) => s.has(el.id));
  }, [elements, selected]);

  const deleteSel = () => {
    const s = new Set(R.current.selected);
    if (!s.size) return;
    commit(R.current.elements.filter((el) => !s.has(el.id)));
    setSel([]);
  };
  const duplicate = () => {
    const s = new Set(R.current.selected);
    const clones = G.cloneElements(R.current.elements.filter((el) => s.has(el.id)), 20);
    if (!clones.length) return;
    commit([...R.current.elements, ...clones]);
    setSel(clones.map((c) => c.id));
  };
  const copy = () => {
    const s = new Set(R.current.selected);
    const els = R.current.elements.filter((el) => s.has(el.id));
    if (!els.length) return false;
    clipboard.current = els;
    navigator.clipboard?.writeText(CLIP_PREFIX + JSON.stringify(els)).catch(() => {});
    showToast(`Copied ${els.length} item${els.length > 1 ? "s" : ""}`);
    return true;
  };
  const pasteElements = (els) => {
    if (!Array.isArray(els) || !els.length) return;
    const b = G.unionBounds(els);
    const [cx, cy] = hover.current || toWorld(window.innerWidth / 2, window.innerHeight / 2);
    const clones = G.cloneElements(els).map((el) => G.translate(el, cx - b.x - b.w / 2, cy - b.y - b.h / 2));
    commit([...R.current.elements, ...clones]);
    setTool("select");
    setSel(clones.map((c) => c.id));
  };
  const insertImage = async (file, at) => {
    try {
      const { src, w, h } = await Store.loadImageFile(file);
      const z = camRef.current.z;
      const k = Math.min(1, (window.innerWidth * 0.5) / z / w, (window.innerHeight * 0.5) / z / h);
      const W = w * k,
        Hh = h * k;
      const [cx, cy] = at || toWorld(window.innerWidth / 2, window.innerHeight / 2);
      const el = {
        id: G.uid(),
        type: "image",
        src,
        x: cx - W / 2,
        y: cy - Hh / 2,
        w: W,
        h: Hh,
        opacity: 1,
        stroke: INK,
        strokeWidth: 1,
      };
      commit([...R.current.elements, el]);
      setToolState("select");
      R.current.tool = "select";
      setSel([el.id]);
    } catch {
      showToast("Could not load that image");
    }
  };
  /** Elements a style change applies to: the selection plus the text being typed in. */
  const styleTargets = () => {
    const ids = new Set(R.current.selected);
    if (R.current.editing) ids.add(R.current.editing);
    return ids;
  };
  const applyStyle = (patch, { live = false } = {}) => {
    setStyle((s) => ({ ...s, ...patch }));
    const r = R.current;
    const sel = styleTargets();
    if (!sel.size) return;
    const next = r.elements.map((el) => {
      if (!sel.has(el.id)) return el;
      const u = { ...el };
      const t = el.type;
      if ("stroke" in patch && t !== "sticky" && t !== "image") u.stroke = patch.stroke;
      if ("fill" in patch && G.isShape(t)) u.fill = patch.fill;
      if ("stickyFill" in patch && t === "sticky") u.fill = patch.stickyFill;
      if ("strokeWidth" in patch && !["text", "sticky", "image"].includes(t)) u.strokeWidth = patch.strokeWidth;
      if ("strokeStyle" in patch && (G.isLinear(t) || G.isShape(t))) u.strokeStyle = patch.strokeStyle;
      if ("opacity" in patch) u.opacity = patch.opacity;
      if ("font" in patch && (t === "text" || t === "sticky")) u.font = patch.font;
      if ("fontSize" in patch && (t === "text" || t === "sticky")) u.fontSize = patch.fontSize;
      for (const k of FMT_KEYS) if (k in patch && TEXT_TYPES.includes(t)) u[k] = patch[k];
      return fitText(u);
    });
    if (r.editing) {
      setLive(next); // recorded as one undo step when typing finishes
    } else if (live) {
      liveBefore.current ||= r.elements;
      setLive(next);
    } else {
      commit(next, liveBefore.current || r.elements);
      liveBefore.current = null;
    }
  };
  /** Current value of a format flag (bold/italic/underline) for the panel and shortcuts. */
  const fmtValue = (k) => {
    const ids = styleTargets();
    const el = R.current.elements.find((e) => ids.has(e.id) && TEXT_TYPES.includes(e.type));
    return el ? !!el[k] : !!R.current.style[k];
  };
  const toggleFmt = (k) => applyStyle({ [k]: !fmtValue(k) });

  /** Toggle bullets / numbers on the text being typed or the selected texts and notes. */
  const applyList = (listStyle) => {
    const ids = styleTargets();
    const r = R.current;
    if (!r.elements.some((el) => ids.has(el.id) && TEXT_TYPES.includes(el.type)))
      return showToast("Click into a text or sticky note first");
    const next = r.elements.map((el) =>
      ids.has(el.id) && TEXT_TYPES.includes(el.type) ? fitText({ ...el, text: Text.applyList(el.text, listStyle) }) : el,
    );
    if (r.editing) setLive(next);
    else commit(next);
  };

  /** Pick a stamp. `quick` = picked while drawing: place one, then go back to the pen. */
  const pickStamp = (item, { quick = false } = {}) => {
    setStyle((s) => ({ ...s, stampKind: item.kind, stamp: item.kind === "number" ? s.stamp : item.v }));
    const r = R.current;
    stampReturn.current = quick && r.tool !== "stamp" ? r.tool : null;
    if (r.tool !== "stamp") {
      finishEdit();
      setToolState("stamp");
      R.current.tool = "stamp";
      setSel([]);
    }
  };

  const undo = () => {
    finishEdit();
    const h = H();
    if (!h.past.length) return;
    h.future.push(R.current.elements);
    setLive(h.past.pop());
    setSel([]);
    setHistTick((t) => t + 1);
  };
  const redo = () => {
    finishEdit();
    const h = H();
    if (!h.future.length) return;
    h.past.push(R.current.elements);
    setLive(h.future.pop());
    setSel([]);
    setHistTick((t) => t + 1);
  };

  // pages
  const switchPage = (id) => {
    finishEdit();
    pageCams.current[R.current.page.id] = camRef.current;
    setSel([]);
    setDoc((d) => ({ ...d, current: id }));
    setCam(pageCams.current[id] || { x: 0, y: 0, z: 1 });
  };
  const addPage = () => {
    const names = new Set(doc.pages.map((p) => p.name));
    let n = doc.pages.length + 1;
    while (names.has(`Page ${n}`)) n++;
    const p = Store.newPage(n);
    setDoc((d) => ({ ...d, pages: [...d.pages, p] }));
    switchPage(p.id);
  };
  const deletePage = (id) => {
    const p = doc.pages.find((x) => x.id === id);
    if (!p || doc.pages.length < 2) return;
    if (p.elements.length && !window.confirm(`Delete "${p.name}" and everything on it?`)) return;
    const idx = doc.pages.findIndex((x) => x.id === id);
    const rest = doc.pages.filter((x) => x.id !== id);
    delete hist.current[id];
    setSel([]);
    setDoc((d) => ({ ...d, pages: rest, current: d.current === id ? rest[Math.max(0, idx - 1)].id : d.current }));
  };
  const renamePage = (id, name) => setDoc((d) => ({ ...d, pages: d.pages.map((p) => (p.id === id ? { ...p, name } : p)) }));

  // files
  const exportTargets = () => (R.current.selected.length ? selEls : R.current.elements);
  const exportPNG = () => {
    const els = exportTargets();
    const cv = renderToCanvas(els, { dark: R.current.doc.dark });
    if (!cv) return showToast("Nothing to export yet");
    cv.toBlob((b) => b && Store.downloadBlob(b, `board-${stamp()}.png`));
    showToast(R.current.selected.length ? "Exported selection as PNG" : "Exported page as PNG");
  };
  const exportSVG = () => {
    const svg = renderToSVG(exportTargets(), { dark: R.current.doc.dark });
    if (!svg) return showToast("Nothing to export yet");
    Store.downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `board-${stamp()}.svg`);
  };
  const saveJSON = () => {
    const data = JSON.stringify({ type: "pro-whiteboard", version: 2, ...R.current.doc });
    Store.downloadBlob(new Blob([data], { type: "application/json" }), `board-${stamp()}.json`);
    showToast("Board saved");
  };
  const openFile = async (file) => {
    if (!file) return;
    try {
      const d = JSON.parse(await Store.readFileAsText(file));
      if (Store.isValidDoc(d)) {
        // Never replace existing work: the file's pages are added next to the current ones.
        finishEdit();
        setSel([]);
        const names = new Set(R.current.doc.pages.map((p) => p.name));
        const imported = d.pages.map((p) => {
          let name = p.name || "Page";
          while (names.has(name)) name += " (imported)";
          names.add(name);
          return { ...p, id: G.uid(), name };
        });
        const keep = R.current.doc.pages.filter((p) => p.elements.length || R.current.doc.pages.length > 1);
        pageCams.current[R.current.page.id] = camRef.current;
        setDoc((cur) => ({ ...cur, pages: [...keep, ...imported], current: imported[0].id }));
        setTimeout(() => fitTo(imported[0].elements), 0);
        showToast(`Added ${imported.length} page${imported.length > 1 ? "s" : ""} from ${file.name}`);
      } else showToast("That file isn't a whiteboard (.json) file");
    } catch {
      showToast("Could not read that file");
    }
  };
  const menuAction = (a) => {
    if (a === "open") fileDoc.current?.click();
    else if (a === "save") saveJSON();
    else if (a === "png") exportPNG();
    else if (a === "svg") exportSVG();
    else if (a === "help") setHelp(true);
    else if (a === "theme") setDoc((d) => ({ ...d, dark: !d.dark }));
    else if (a === "snap") setDoc((d) => ({ ...d, snap: !d.snap }));
    else if (a === "fullscreen") toggleFullscreen();
    else if (a === "clear") {
      if (R.current.elements.length && window.confirm("Clear everything on this page? You can undo this.")) {
        commit([]);
        setSel([]);
      }
    } else if (a.startsWith("bg:")) setDoc((d) => ({ ...d, bg: a.slice(3) }));
  };
  const toggleFullscreen = () =>
    document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.().catch(() => {});

  // ---------------------------------------------------------------- global listeners
  // Handlers change every render; listeners call through this ref so they always see fresh state.
  const api = useRef({});
  api.current = {
    onKeyDown(e) {
      if (isTyping(e.target)) return;
      const r = R.current;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.key === " ") {
        e.preventDefault();
        if (!spaceDown.current) {
          spaceDown.current = true;
          canvasRef.current.style.cursor = "grab";
        }
        return;
      }
      if (mod) {
        const fmt = { b: "bold", i: "italic", u: "underline" }[k];
        if (fmt) {
          e.preventDefault();
          return toggleFmt(fmt);
        }
        if (e.shiftKey && (e.code === "Digit8" || e.code === "Digit7")) {
          e.preventDefault();
          return applyList(e.code === "Digit8" ? "•" : "num");
        }
        if (k === "z") (e.preventDefault(), e.shiftKey ? redo() : undo());
        else if (k === "y") (e.preventDefault(), redo());
        else if (k === "a") {
          e.preventDefault();
          setTool("select");
          setSel(r.elements.map((el) => el.id));
        } else if (k === "d") (e.preventDefault(), duplicate());
        else if (k === "c") copy();
        else if (k === "x") copy() && deleteSel();
        else if (k === "s") (e.preventDefault(), saveJSON());
        else if (k === "o") (e.preventDefault(), fileDoc.current?.click());
        else if (k === "e") (e.preventDefault(), exportPNG());
        else if (e.key === "=" || e.key === "+") (e.preventDefault(), zoomCmd("in"));
        else if (e.key === "-") (e.preventDefault(), zoomCmd("out"));
        else if (e.key === "0") (e.preventDefault(), zoomCmd("reset"));
        else if (e.code === "BracketRight" && r.selected.length)
          (e.preventDefault(), commit(G.reorder(r.elements, r.selected, e.shiftKey ? "front" : "forward")));
        else if (e.code === "BracketLeft" && r.selected.length)
          (e.preventDefault(), commit(G.reorder(r.elements, r.selected, e.shiftKey ? "back" : "backward")));
        return;
      }
      if (e.altKey) return;
      if (e.key === "Delete" || e.key === "Backspace") return deleteSel();
      if (e.key === "Escape") {
        setHelp(false);
        return setSel([]);
      }
      if (e.key.startsWith("Arrow") && r.selected.length) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
        const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
        const s = new Set(r.selected);
        return commit(r.elements.map((el) => (s.has(el.id) ? G.translate(el, dx, dy) : el)));
      }
      if (e.shiftKey && e.code === "Digit1") return zoomCmd("fit");
      if (e.key === "?") return setHelp((h) => !h);
      if (e.key === ".") {
        const i = POINTERS.indexOf(r.style.pointer);
        const next = POINTERS[(i + 1) % POINTERS.length];
        setStyle((s) => ({ ...s, pointer: next }));
        return showToast(`Pointer: ${next}`);
      }
      if (k === "f") return toggleFullscreen();
      if (KEYMAP[k] && !e.shiftKey) setTool(KEYMAP[k]);
    },
    onKeyUp(e) {
      if (e.key === " ") {
        spaceDown.current = false;
        if (canvasRef.current) canvasRef.current.style.cursor = toolCursor();
      }
    },
    onPaste(e) {
      if (isTyping(e.target)) return;
      const dt = e.clipboardData;
      if (!dt) return;
      const file = [...dt.files].find((f) => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        return insertImage(file, hover.current);
      }
      const text = dt.getData("text/plain") || "";
      if (text.startsWith(CLIP_PREFIX)) {
        try {
          return pasteElements(JSON.parse(text.slice(CLIP_PREFIX.length)));
        } catch {
          return showToast("Clipboard data is damaged");
        }
      }
      if (text.trim()) {
        const [x, y] = hover.current || toWorld(window.innerWidth / 2, window.innerHeight / 2);
        const { el, before } = createText(x, y, text.slice(0, 5000));
        commit([...before, el], before);
        setTool("select");
        setSel([el.id]);
      } else if (clipboard.current) pasteElements(clipboard.current);
    },
    onWheel(e) {
      e.preventDefault();
      const c = camRef.current;
      if (e.ctrlKey || e.metaKey) {
        const f = Math.exp(-Math.max(-50, Math.min(50, e.deltaY * (e.deltaMode ? 20 : 1))) * 0.005);
        zoomAt(e.clientX, e.clientY, c.z * f);
      } else {
        const k = e.deltaMode ? 20 : 1;
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        setCam({ ...c, x: c.x - dx * k, y: c.y - dy * k });
      }
    },
  };

  useEffect(() => {
    const kd = (e) => api.current.onKeyDown(e),
      ku = (e) => api.current.onKeyUp(e),
      ps = (e) => api.current.onPaste(e),
      wh = (e) => api.current.onWheel(e),
      blur = () => (spaceDown.current = false);
    const cv = canvasRef.current;
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("paste", ps);
    window.addEventListener("blur", blur);
    cv.addEventListener("wheel", wh, { passive: false });
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("paste", ps);
      window.removeEventListener("blur", blur);
      cv.removeEventListener("wheel", wh);
    };
  }, []);

  // ---------------------------------------------------------------- rendering
  const draw = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = cv.width / dpr,
      Hh = cv.height / dpr;
    const r = R.current,
      c = camRef.current,
      dark = r.doc.dark;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(ctx, W, Hh, c, r.doc.bg, dark);

    ctx.setTransform(dpr * c.z, 0, 0, dpr * c.z, dpr * c.x, dpr * c.y);
    const view = { x: -c.x / c.z, y: -c.y / c.z, w: W / c.z, h: Hh / c.z };
    const er = erased.current;
    for (const el of r.elements) {
      if (!G.intersects(G.getBounds(el), view)) continue;
      drawElement(ctx, el, { dark, hideText: el.id === r.editing, ghost: er.has(el.id) });
    }
    if (draft.current) drawElement(ctx, draft.current, { dark, noCache: true });

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = new Set(r.selected);
    drawSelectionUI(ctx, c, r.elements.filter((el) => s.has(el.id)), marquee.current, dark);

    // laser trail
    const now = performance.now(),
      L = laser.current;
    while (L.length && now - L[0].t > LASER_MS) L.shift();
    if (L.length) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.shadowColor = "#ff2d2d";
      ctx.shadowBlur = 14;
      ctx.strokeStyle = "#ff3b3b";
      for (let i = 1; i < L.length; i++) {
        const a = L[i - 1],
          b = L[i];
        if (a.s !== b.s) continue;
        const age = (now - b.t) / LASER_MS;
        ctx.globalAlpha = Math.max(0, 1 - age);
        ctx.lineWidth = 5 * (1 - age * 0.6);
        ctx.beginPath();
        ctx.moveTo(a.x * c.z + c.x, a.y * c.z + c.y);
        ctx.lineTo(b.x * c.z + c.x, b.y * c.z + c.y);
        ctx.stroke();
      }
      if (I.current.mode === "laser") {
        const p = L[L.length - 1];
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#ff3b3b";
        ctx.beginPath();
        ctx.arc(p.x * c.z + c.x, p.y * c.z + c.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // eraser cursor
    if (r.tool === "eraser" && hover.current) {
      const [hx, hy] = hover.current;
      ctx.beginPath();
      ctx.arc(hx * c.z + c.x, hy * c.z + c.y, 6 + r.style.strokeWidth * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";
      ctx.fill();
      ctx.strokeStyle = dark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  useEffect(() => {
    let raf;
    const loop = () => {
      if (dirty.current || laser.current.length || I.current.mode === "draw") {
        dirty.current = false;
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
    // draw reads everything through refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    dirty.current = true;
  });

  useEffect(() => {
    const fit = () => {
      const cv = canvasRef.current,
        dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(window.innerWidth * dpr);
      cv.height = Math.round(window.innerHeight * dpr);
      cv.style.width = window.innerWidth + "px";
      cv.style.height = window.innerHeight + "px";
      dirty.current = true;
    };
    fit();
    window.addEventListener("resize", fit);
    setAssetListener(() => (dirty.current = true));
    // Re-measure text once web fonts arrive (stored sizes may come from a fallback font).
    document.fonts?.ready.then(() => {
      const els = R.current.elements;
      if (els.some((el) => el.type === "text")) setLive(els.map(fitText));
    });
    return () => window.removeEventListener("resize", fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------- persistence
  // 1) First paint uses the sync localStorage copy; then the newest copy (IndexedDB or localStorage) wins.
  // 2) Nothing is written until that load finishes, so a blank start-up board can never overwrite saved work.
  useEffect(() => {
    let alive = true;
    Store.loadDocAsync()
      .then((d) => {
        if (alive && d && (d.savedAt || 0) > (R.current.doc.savedAt || 0)) {
          remoteDoc.current = d;
          setDoc(d);
        }
      })
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  // 1b) Authenticated User (sign-in or restored session): Load cloud whiteboard from MongoDB Atlas
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;

    setCloudStatus("saving");
    whiteboardApi
      .loadBoard()
      .then(async (boardRes) => {
        if (!alive) return;
        if (boardRes?.whiteboard?.doc && Store.isValidDoc(boardRes.whiteboard.doc)) {
          remoteDoc.current = boardRes.whiteboard.doc;
          setDoc(boardRes.whiteboard.doc);
          setCurrentBoardId(boardRes.whiteboard.id);
        } else {
          // Initial cloud save for this user
          await whiteboardApi.saveBoard(doc, `${user.name}'s Board`);
        }
        setCloudStatus("synced");
      })
      .catch((err) => {
        console.warn("Cloud session note:", err.message);
        if (alive) setCloudStatus("offline");
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // A protected request returned 401: the session expired or was revoked elsewhere
  useEffect(() => {
    const handleExpired = () => {
      refetchSession();
      setCurrentBoardId(null);
      showToast("Session expired. Please sign in again.");
    };
    window.addEventListener("vairaa:auth-expired", handleExpired);
    return () => window.removeEventListener("vairaa:auth-expired", handleExpired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAuthSuccess = (newUser) => {
    showToast(`Signed in as ${newUser.name}`);
  };

  const handleLogout = async () => {
    const { error } = await authClient.signOut();
    if (error) {
      showToast("Sign out failed. Please try again.");
      return;
    }
    setCurrentBoardId(null);
    showToast("Signed out. Whiteboard autosaves locally in this browser.");
  };

  const flushSave = () => {
    const d = pendingSave.current;
    if (!d) return;
    pendingSave.current = null;
    Store.persistDoc(d).then((ok) => {
      if (!ok && !storageWarned.current) {
        storageWarned.current = true;
        showToast("Could not save in this browser — use Save board to keep your work");
      }
    });

    // Cloud auto-sync per user to MongoDB Atlas
    if (user) {
      setCloudStatus("saving");
      whiteboardApi
        .saveBoard(d, undefined, currentBoardId)
        .then((res) => {
          if (res?.whiteboard?.id && !currentBoardId) {
            setCurrentBoardId(res.whiteboard.id);
          }
          setCloudStatus("synced");
        })
        .catch((err) => {
          console.warn("Cloud save warning:", err.message);
          setCloudStatus("offline");
        });
    }
  };
  useEffect(() => {
    if (!loaded || doc === remoteDoc.current) return;
    pendingSave.current = doc;
    const t = setTimeout(flushSave, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, loaded]);

  // 3) Reload / close / tab switch: write immediately so the last stroke is never lost.
  // 4) Another tab saved: adopt its board, so an old tab can't overwrite newer work.
  useEffect(() => {
    const now = () => {
      if (pendingSave.current) {
        Store.persistDocNow(pendingSave.current);
        pendingSave.current = null;
      }
    };
    const onVis = () => document.visibilityState === "hidden" && now();
    const onStorage = (e) => {
      if (e.key !== Store.REV_KEY || !e.newValue) return;
      try {
        if (JSON.parse(e.newValue).tab === Store.TAB_ID) return;
      } catch {
        return;
      }
      Store.loadDocAsync().then((d) => {
        if (!d) return;
        const cur = R.current.doc.current;
        const next = d.pages.some((p) => p.id === cur) ? { ...d, current: cur } : d;
        remoteDoc.current = next;
        pendingSave.current = null;
        setDoc(next);
      });
    };
    window.addEventListener("pagehide", now);
    window.addEventListener("beforeunload", now);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("pagehide", now);
      window.removeEventListener("beforeunload", now);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  useEffect(() => Store.saveStyle(style), [style]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", doc.dark);
    document.documentElement.style.colorScheme = doc.dark ? "dark" : "light";
  }, [doc.dark]);
  useEffect(() => {
    if (canvasRef.current && !spaceDown.current) canvasRef.current.style.cursor = toolCursor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, style.pointer, style.stroke, style.strokeWidth, style.stamp, style.stampKind, doc.dark, cam.z]);
  useEffect(() => {
    if (!editing) return;
    const ta = taRef.current;
    if (ta) {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, [editing]);

  // ---------------------------------------------------------------- view
  const h = hist.current[page.id];
  const canUndo = !!h?.past.length,
    canRedo = !!h?.future.length;

  const editEl = editing && elements.find((el) => el.id === editing);
  const ctxTypes = editEl
    ? [editEl.type]
    : selected.length
      ? [...new Set(selEls.map((e) => e.type))]
      : DRAW_TOOLS.includes(tool)
        ? [tool]
        : [];
  const showPanel = ctxTypes.length > 0;
  const first = editEl || selEls[0];
  const values = first
    ? {
        ...style,
        stroke: first.stroke ?? style.stroke,
        fill: first.type === "sticky" ? style.fill : (first.fill ?? style.fill),
        stickyFill: first.type === "sticky" ? first.fill : style.stickyFill,
        strokeWidth: first.strokeWidth ?? style.strokeWidth,
        strokeStyle: first.strokeStyle ?? style.strokeStyle,
        opacity: first.opacity ?? 1,
        font: first.font ?? style.font,
        fontSize: first.fontSize ?? style.fontSize,
        ...(TEXT_TYPES.includes(first.type)
          ? { bold: !!first.bold, italic: !!first.italic, underline: !!first.underline }
          : {}),
      }
    : style;

  let editorStyle = null;
  if (editEl) {
    const z = cam.z,
      sticky = editEl.type === "sticky";
    const pad = sticky ? STICKY_PAD : 0;
    editorStyle = {
      left: (editEl.x + pad) * z + cam.x,
      top: (editEl.y + pad) * z + cam.y,
      width: sticky ? (editEl.w - pad * 2) * z : (editEl.w + editEl.fontSize) * z,
      height: sticky ? (editEl.h - pad * 2) * z : editEl.h * z,
      fontSize: editEl.fontSize * z,
      lineHeight: LINE_HEIGHT,
      fontFamily: FONTS[editEl.font] || FONTS.sans,
      color: sticky ? "#1f2937" : colorFor(editEl.stroke, doc.dark),
      opacity: editEl.opacity ?? 1,
      whiteSpace: sticky ? "pre-wrap" : "pre",
      overflowWrap: sticky ? "break-word" : "normal",
      fontWeight: editEl.bold ? 700 : 400,
      fontStyle: editEl.italic ? "italic" : "normal",
      textDecoration: editEl.underline ? "underline" : "none",
    };
  }

  return (
    <div
      className="fixed inset-0 select-none"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (!f) return;
        if (f.type.startsWith("image/")) insertImage(f, toWorld(e.clientX, e.clientY));
        else if (f.name.endsWith(".json")) openFile(f);
        else showToast("Drop an image or a board .json file");
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          hover.current = null;
          dirty.current = true;
        }}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Whiteboard canvas"
      />

      {editEl && (
        <textarea
          ref={taRef}
          value={editEl.text}
          onChange={(e) => onEditText(e.target.value)}
          onBlur={finishEdit}
          onKeyDown={(e) => {
            e.stopPropagation();
            const mod = e.ctrlKey || e.metaKey;
            if (e.key === "Escape" || (e.key === "Enter" && mod)) {
              e.preventDefault();
              return finishEdit();
            }
            const fmt = mod && { b: "bold", i: "italic", u: "underline" }[e.key.toLowerCase()];
            if (fmt) {
              e.preventDefault();
              return toggleFmt(fmt);
            }
            if (mod && e.shiftKey && (e.code === "Digit8" || e.code === "Digit7")) {
              e.preventDefault();
              return applyList(e.code === "Digit8" ? "•" : "num");
            }
            // Enter inside a point continues the list; Enter on an empty point ends it.
            if (e.key === "Enter" && !e.shiftKey && !mod) {
              const ta = e.currentTarget,
                v = ta.value,
                pos = ta.selectionStart;
              const ls = v.lastIndexOf("\n", pos - 1) + 1;
              const le = v.indexOf("\n", pos);
              const c = Text.continueList(v.slice(ls, le < 0 ? v.length : le));
              if (!c) return;
              e.preventDefault();
              if (c.empty) ta.setRangeText("", ls, ls + c.prefixLen, "start");
              else ta.setRangeText("\n" + c.next, pos, ta.selectionEnd, "end");
              onEditText(ta.value);
            }
          }}
          spellCheck={false}
          placeholder={editEl.type === "text" ? "Type…" : ""}
          className="fixed z-10 resize-none outline-none border-0 bg-transparent p-0 m-0 overflow-hidden placeholder:text-zinc-400/60 caret-indigo-500"
          style={editorStyle}
        />
      )}

      {/* top row */}
      <div className="fixed top-3 left-3 right-3 z-30 flex items-start justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          <TopMenu
            doc={doc}
            onAction={menuAction}
            user={user}
            onOpenAuth={() => setAuthOpen(true)}
            onLogout={handleLogout}
            cloudStatus={cloudStatus}
          />
          {user ? (
            <div
              className="panel flex items-center gap-2.5 h-11 px-3.5 rounded-2xl text-xs font-medium text-zinc-700 dark:text-zinc-200 cursor-default"
              title={`Logged in as ${user.name} (${user.email}) - Isolated Whiteboard`}
            >
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:block leading-tight text-left">
                <div className="font-semibold text-zinc-800 dark:text-zinc-100 truncate max-w-[120px]">
                  {user.name}
                </div>
                {user.company && (
                  <div className="text-[10px] text-zinc-400 truncate max-w-[120px]">
                    {user.company}
                  </div>
                )}
              </div>
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  cloudStatus === "saving" ? "bg-amber-400 animate-ping" : "bg-emerald-500"
                }`}
                title={cloudStatus === "saving" ? "Syncing to cloud..." : "Cloud synced to Atlas"}
              />
            </div>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="panel flex items-center gap-2 h-11 px-3.5 rounded-2xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer"
              title="Sign In with OTP to save your whiteboard per user"
            >
              <UserIcon size={15} />
              <span className="hidden sm:inline">Sign In / Cloud Sync</span>
            </button>
          )}
        </div>
        <div className="pointer-events-auto lg:absolute lg:left-1/2 lg:-translate-x-1/2">
          <Toolbar tool={tool} onTool={setTool} />
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button
            className="panel hidden xl:inline-flex items-center gap-2 h-11 px-4 rounded-2xl text-sm font-semibold text-white !bg-indigo-500 hover:!bg-indigo-600 transition"
            onClick={exportPNG}
            title="Export PNG (Ctrl+E)"
          >
            <ImageDown size={17} /> Export
          </button>
          <button className="panel icon-btn !w-11 !h-11" title="Shortcuts (?)" aria-label="Keyboard shortcuts" onClick={() => setHelp(true)}>
            <HelpCircle size={19} />
          </button>
        </div>
      </div>

      {/* properties */}
      {showPanel && (
        <div
          className="fixed left-3 top-[68px] z-20 flex flex-col items-start gap-2"
          // Keep the text cursor in the note/text while clicking panel buttons (B / I / U, points…).
          onMouseDown={(e) => editing && e.target.tagName !== "INPUT" && e.preventDefault()}
        >
          <button
            className={`panel icon-btn !w-11 !h-11 ${panelOpen ? "on" : ""}`}
            title={panelOpen ? "Hide style panel" : "Show style panel"}
            aria-label="Toggle style panel"
            onClick={() => setPanelOpen((o) => !o)}
          >
            {panelOpen ? <X size={18} /> : <Palette size={18} />}
          </button>
          {panelOpen && (
            <PropsPanel
              types={ctxTypes}
              values={values}
              onChange={applyStyle}
              selCount={selected.length}
              dark={doc.dark}
              onLayer={(dir) => commit(G.reorder(elements, selected, dir))}
              onAlign={(k) => commit(G.align(elements, selected, k))}
              onDuplicate={duplicate}
              onDelete={deleteSel}
              editing={!!editEl}
              onToggleFmt={toggleFmt}
              onList={applyList}
              onStamp={pickStamp}
            />
          )}
        </div>
      )}

      {/* bottom */}
      <div className="fixed bottom-3 left-3 right-3 z-20 flex flex-col-reverse items-start lg:flex-row lg:items-end gap-2 pointer-events-none">
        <div className="pointer-events-auto">
          <ZoomControls zoom={cam.z} onZoom={zoomCmd} onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} />
        </div>
        <div className="pointer-events-auto lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:bottom-0">
          <PageTabs
            pages={doc.pages}
            current={page.id}
            onSelect={switchPage}
            onAdd={addPage}
            onRename={renamePage}
            onDelete={deletePage}
          />
        </div>
        <div className="hidden xl:block ml-auto self-end text-xs text-zinc-400 bg-white/70 dark:bg-zinc-900/70 backdrop-blur px-3 py-1.5 rounded-full">
          {elements.length} item{elements.length === 1 ? "" : "s"} · Space-drag to pan · Ctrl+scroll to zoom · ? shortcuts
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm shadow-lg dark:bg-white dark:text-zinc-900"
        >
          {toast}
        </div>
      )}
      {help && <HelpModal onClose={() => setHelp(false)} />}
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      <input
        ref={fileImg}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) insertImage(f);
          e.target.value = "";
        }}
      />
      <input
        ref={fileDoc}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          openFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
