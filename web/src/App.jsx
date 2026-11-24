import { useEffect, useMemo, useRef, useState } from "react";
import { Palette, HelpCircle, ImageDown, X, User as UserIcon, Presentation, Radio } from "lucide-react";
import Toolbar from "./components/Toolbar";
import PropsPanel from "./components/PropsPanel";
import TopMenu from "./components/TopMenu";
import { ZoomControls, PageTabs } from "./components/BottomBar";
import HelpModal from "./components/HelpModal";
import AuthModal from "./components/AuthModal";
import RichEditDialog from "./components/RichEditDialog";
import TemplatePicker from "./components/TemplatePicker";
import PageOverview from "./components/PageOverview";
import ClassTimer from "./components/ClassTimer";
import PresenterBar from "./components/PresenterBar";
import GraphDialog from "./components/GraphDialog";
import ShareDialog from "./components/ShareDialog";
import RecordingPill from "./components/RecordingPill";
import { pdfToSlides, pdfErrorMessage, MAX_PDF_PAGES } from "./lib/pdf";
import { recognize } from "./lib/shapes";
import * as Guides from "./lib/guides";
import { startRecording, canRecord } from "./lib/recorder";
import { GRAPH_DEFAULTS } from "./lib/graph";
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
  preloadAssets,
  COVER_FILL,
  FONTS,
  LINE_HEIGHT,
  STICKY_PAD,
  INK,
} from "./lib/render";
import * as Store from "./lib/storage";
import { pointerCSS, stampCursor, POINTER_TOOLS, POINTERS } from "./lib/cursors";
import * as Text from "./lib/text";

const DRAW_TOOLS = ["pen", "hl", "eraser", "line", "arrow", "rect", "ellipse", "diamond", "text", "sticky", "stamp", "compass", "cover"];
// Tools that are on/off overlays rather than modes
const GUIDE_TOOLS = ["ruler", "protractor"];
// Pen pressure response: exponent applied to the stylus pressure (lower = ink comes easier)
const PRESSURE_GAMMA = { soft: 0.6, normal: 1, firm: 1.6 };
const HOLD_MS = 550; // hold still this long at the end of a stroke to snap it to a shape
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
  codeTheme: "dark",
  codeFontSize: 20,
  codeLanguage: "javascript",
  lineNumbers: true,
  mathSize: 40,
  shapeSnap: true,
  pressureCurve: "normal",
  palmReject: true,
  eraserMode: "stroke",
  coverFill: COVER_FILL,
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
  b: "code",
  q: "math",
  w: "lasso",
  y: "graph",
  u: "cover",
  j: "compass",
};
const RICH_TYPES = ["code", "math", "graph"];
// Slide images are imported 1280 world units wide (roughly one screen at 100% zoom)
const SLIDE_WIDTH = 1280;
const PRESENT_NEXT = ["ArrowRight", "ArrowDown", "PageDown"];
const PRESENT_PREV = ["ArrowLeft", "ArrowUp", "PageUp"];
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
  const filePdf = useRef(null);

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

  // Teaching: presentation mode, spotlight, timer, page overview, templates, code/math editor
  const [presenting, setPresenting] = useState(false);
  const [spotlight, setSpotlight] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [overview, setOverview] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [richEdit, setRichEdit] = useState(null); // { kind, id? , at?, initial }
  const [guideOn, setGuideOn] = useState({ ruler: false, protractor: false });
  const [recording, setRecording] = useState(null); // { startedAt, mic } while recording
  const [shareOpen, setShareOpen] = useState(false);
  const [liveCode, setLiveCode] = useState(null); // share code while students can watch live

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
  R.current = { doc, page, elements, tool, style, selected, editing, presenting, spotlight };

  const camRef = useRef(cam);
  const I = useRef({ mode: "idle" }); // current interaction
  const draft = useRef(null); // element being drawn
  const sceneCache = useRef({ canvas: document.createElement("canvas"), els: null }); // board snapshot while inking
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
  const spotPos = useRef(null); // last pointer position in screen coords (spotlight)
  const presentFullscreen = useRef(false); // presentation mode entered fullscreen itself
  const guides = useRef({ ruler: null, protractor: null }); // geometry guides on the board (session only)
  const compass = useRef(null); // { cx, cy, r, ha } once the compass radius is set
  const lasso = useRef(null); // lasso path in world coords while selecting
  const holdTimer = useRef(null); // quick-shape timer while the pen rests at the end of a stroke
  const penSeen = useRef(false); // a stylus has been used: fingers pan instead of draw
  const ignoredPointers = useRef(new Set()); // palm contacts rejected while the stylus is down
  const recorder = useRef(null);

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
      if (G.isLocked(el) || (types && !types.includes(el.type))) continue;
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
    const mx = Math.min(160, W * 0.08),
      my = Math.min(200, Hh * 0.2);
    const z = clampZ(Math.min((W - mx) / Math.max(b.w, 1), (Hh - my) / Math.max(b.h, 1), 2));
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
  const toggleGuide = (kind) => {
    const on = !guides.current[kind];
    if (on) {
      const [cx, cy] = toWorld(window.innerWidth / 2, window.innerHeight / 2);
      guides.current[kind] = kind === "ruler" ? Guides.newRuler(cx, cy) : Guides.newProtractor(cx, cy);
      showToast(
        kind === "ruler"
          ? "Ruler: drag to move, turn with the round knob, draw along an edge for a straight line"
          : "Protractor: drag to move, turn with the knob, draw along the arc or base to follow it",
      );
    } else guides.current[kind] = null;
    setGuideOn((g) => ({ ...g, [kind]: on }));
    dirty.current = true;
  };
  const setTool = (t) => {
    if (t === "image") return fileImg.current?.click();
    if (t === "template") return setTemplatesOpen(true);
    if (GUIDE_TOOLS.includes(t)) return toggleGuide(t);
    if (t === "compass" && R.current.tool !== "compass")
      showToast("Compass: drag from the centre to set the radius, then drag around to draw");
    if (t !== "compass") compass.current = null;
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
      ...(R.current.presenting && { annot: true }),
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
    // Partial mode cuts through pen / highlighter ink; everything else is still erased whole
    const partial = R.current.style.eraserMode === "partial";
    let els = R.current.elements,
      cut = false;
    for (let s = 0; s <= steps; s++) {
      const px = x0 + ((x1 - x0) * s) / steps,
        py = y0 + ((y1 - y0) * s) / steps;
      let changed = false;
      const next = [];
      for (const el of els) {
        if (partial && (el.type === "pen" || el.type === "hl") && !G.isLocked(el) && G.hitTest(el, px, py, rad)) {
          const pieces = G.splitStroke(el, px, py, rad);
          if (pieces.length !== 1 || pieces[0] !== el) changed = true;
          next.push(...pieces);
          continue;
        }
        if (!set.has(el.id) && !G.isLocked(el) && G.hitTest(el, px, py, rad)) set.add(el.id);
        next.push(el);
      }
      if (changed) {
        els = next;
        cut = true;
      }
    }
    if (cut) setLive(els);
  };
  const beginPinch = () => {
    const m = I.current;
    if (m.before && (m.moved || m.mode === "erase")) setLive(m.before);
    clearTimeout(holdTimer.current);
    draft.current = null;
    marquee.current = null;
    lasso.current = null;
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
              keep: selEls.some((el) => ["text", "image", "stamp", "code", "math"].includes(el.type)),
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

  /** Pressure for a pointer sample, shaped by the pen's pressure setting. */
  const pressureOf = (v) => {
    const curve = R.current.style.pressureCurve;
    if (v.pointerType !== "pen" || curve === "off" || !v.pressure) return 0.5;
    return Math.pow(v.pressure, PRESSURE_GAMMA[curve] || 1);
  };
  /** Pen points for a pointer event, following a ruler / protractor edge when the stroke started on one. */
  const penPoint = (v, snap) => {
    const [x, y] = toWorld(v.clientX, v.clientY);
    const [px, py] = snap ? Guides.applySnap(snap, x, y, draft.current?.strokeWidth || 4) : [x, y];
    return [px, py, pressureOf(v)];
  };
  const activeGuides = () => Object.values(guides.current).filter(Boolean);
  /** Hold still at the end of a pen stroke → replace it with the recognised clean shape. */
  const trySnapShape = () => {
    const m = I.current,
      d = draft.current;
    if (m.mode !== "draw" || m.snapped || m.snap || !d || d.type !== "pen") return;
    const s = recognize(d.points);
    if (!s) return;
    const { points: _p, pressure: _pr, ...rest } = d;
    draft.current =
      s.type === "line"
        ? { ...rest, type: "line", strokeStyle: "solid", points: s.points }
        : { ...rest, type: s.type, strokeStyle: "solid", fill: "transparent", x: s.x, y: s.y, w: s.w, h: s.h };
    m.snapped = true;
    dirty.current = true;
  };

  const onPointerDown = (e) => {
    const cv = canvasRef.current;
    e.preventDefault(); // keeps focus where it is (text editor) and blocks mouse-compat events
    const r = R.current;
    // Palm rejection: once a stylus is in use, touches never draw. Touches while the stylus
    // is down are ignored entirely (a resting palm); otherwise one finger pans, two pinch.
    const palmMode = r.style.palmReject && penSeen.current;
    if (e.pointerType === "pen") {
      penSeen.current = true;
      if (r.style.palmReject) {
        let dropped = false;
        for (const [id, p] of pointers.current)
          if (p.type === "touch") {
            ignoredPointers.current.add(id);
            pointers.current.delete(id);
            dropped = true;
          }
        if (dropped && (I.current.mode === "pan" || I.current.mode === "pinch")) I.current = { mode: "idle" };
      }
    }
    if (palmMode && e.pointerType === "touch" && [...pointers.current.values()].some((p) => p.type === "pen")) {
      ignoredPointers.current.add(e.pointerId);
      return;
    }
    try {
      cv.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (pointers.current.size === 2) return beginPinch();
    if (pointers.current.size > 2) return;
    if (R.current.editing) {
      finishEdit();
      return;
    }
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    const z = camRef.current.z;
    const fingerPans = palmMode && e.pointerType === "touch";
    if (e.button === 1 || spaceDown.current || r.tool === "hand" || fingerPans) {
      I.current = { mode: "pan", sx: e.clientX, sy: e.clientY, cam0: camRef.current, pid: e.pointerId };
      cv.style.cursor = "grabbing";
      return;
    }
    if (e.button !== 0) return;

    // Presenting: tapping a covered answer reveals it, whatever tool is active
    if (r.presenting) {
      const cover = topHit(wx, wy, ["cover"]);
      if (cover && !cover.revealed) {
        setLive(r.elements.map((el) => (el.id === cover.id ? { ...el, revealed: true } : el)));
        return;
      }
    }

    // Ruler / protractor: grab to move, knob to rotate (pen strokes along an edge snap, below)
    for (const g of activeGuides()) {
      const part = Guides.hitGuide(g, wx, wy, z);
      if (!part) continue;
      I.current =
        part === "rotate"
          ? { mode: "guide-rotate", g: g.kind, a0: g.a, p0: Math.atan2(wy - g.y, wx - g.x), pid: e.pointerId }
          : { mode: "guide-move", g: g.kind, sx: wx, sy: wy, x0: g.x, y0: g.y, pid: e.pointerId };
      dirty.current = true;
      return;
    }
    const st = r.style;
    const base = {
      id: G.uid(),
      stroke: st.stroke,
      strokeWidth: st.strokeWidth,
      strokeStyle: st.strokeStyle,
      opacity: st.opacity,
      // Ink added while presenting can be wiped in one go without touching the lesson content
      ...(r.presenting && { annot: true }),
    };
    const sx = snapV(wx),
      sy = snapV(wy);
    switch (r.tool) {
      case "select":
        selectDown(e, wx, wy);
        break;
      case "pen":
      case "hl": {
        let snap = null;
        for (const g of activeGuides()) if ((snap = Guides.snapFor(g, wx, wy, z))) break;
        draft.current = {
          ...base,
          type: r.tool,
          strokeStyle: "solid",
          // "off" pressure = uniform width (all samples 0.5) instead of speed-simulated pressure
          pressure: e.pointerType === "pen" || !!snap || r.style.pressureCurve === "off",
          points: [],
        };
        draft.current.points.push(penPoint(e, snap));
        sceneCache.current.els = null; // re-snapshot: assets may have loaded since the last stroke
        I.current = { mode: "draw", snap, anchor: [e.clientX, e.clientY] };
        clearTimeout(holdTimer.current);
        break;
      }
      case "lasso":
        lasso.current = [[wx, wy]];
        I.current = { mode: "lasso" };
        break;
      case "compass": {
        const c = compass.current;
        const tol = 14 / z;
        if (c && Math.hypot(wx - c.cx, wy - c.cy) <= tol) {
          I.current = { mode: "compass-move", sx: wx, sy: wy, c0: c };
        } else if (!c || Math.hypot(wx - c.cx - c.r * Math.cos(c.ha), wy - c.cy - c.r * Math.sin(c.ha)) <= tol) {
          // set (or re-set) the radius by dragging out from the centre
          const cx = c ? c.cx : wx,
            cy = c ? c.cy : wy;
          compass.current = { cx, cy, r: c ? c.r : 0, ha: c ? c.ha : 0 };
          I.current = { mode: "compass-set" };
        } else {
          const a = Math.atan2(wy - c.cy, wx - c.cx);
          draft.current = {
            ...base,
            type: "pen",
            strokeStyle: "solid",
            pressure: true,
            points: [[c.cx + c.r * Math.cos(a), c.cy + c.r * Math.sin(a), 0.5]],
          };
          sceneCache.current.els = null;
          I.current = { mode: "draw", arc: { prev: a, sweep: 0 } };
        }
        break;
      }
      case "cover":
        draft.current = { ...base, type: "cover", fill: st.coverFill, revealed: false, x: sx, y: sy, w: 0, h: 0 };
        I.current = { mode: "create", sx, sy };
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
        I.current = { mode: "erase", last: [wx, wy], before: r.elements };
        eraseAlong(wx, wy, wx, wy);
        break;
      case "code":
      case "math":
      case "graph":
        setRichEdit({
          kind: r.tool,
          at: [wx, wy],
          initial: r.tool === "code" ? { language: st.codeLanguage, theme: st.codeTheme, lineNumbers: st.lineNumbers } : {},
        });
        break;
      case "laser":
        laserStroke.current++;
        laser.current.push({ x: wx, y: wy, t: performance.now(), s: laserStroke.current });
        I.current = { mode: "laser" };
        break;
    }
    // Only the pointer that started an interaction drives it (a second contact can't scribble into it)
    if (I.current.mode !== "idle" && I.current.mode !== "pinch") I.current.pid = e.pointerId;
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
    if (ignoredPointers.current.has(e.pointerId)) return;
    if (pointers.current.has(e.pointerId))
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    const m = I.current;
    if (m.pid !== undefined && m.pid !== e.pointerId) return;
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    hover.current = [wx, wy];
    spotPos.current = [e.clientX, e.clientY];
    if (m.mode === "pinch") return updatePinch();
    if (m.mode === "idle") {
      if (e.pointerType !== "touch") updateCursor(e, wx, wy);
      if (R.current.tool === "eraser" || R.current.spotlight) dirty.current = true;
      return;
    }
    const r = R.current,
      z = camRef.current.z;
    switch (m.mode) {
      case "pan":
        setCam({ ...m.cam0, x: m.cam0.x + e.clientX - m.sx, y: m.cam0.y + e.clientY - m.sy });
        break;
      case "draw": {
        if (m.snapped || !draft.current) return; // already turned into a clean shape
        const evs = e.getCoalescedEvents?.() || [];
        const pts = draft.current.points;
        if (m.arc) {
          // compass: follow the pointer's angle around the centre, at the fixed radius
          const c = compass.current;
          const a = Math.atan2(wy - c.cy, wx - c.cx);
          let d = a - m.arc.prev;
          if (d > Math.PI) d -= 2 * Math.PI;
          if (d < -Math.PI) d += 2 * Math.PI;
          const total = Math.max(-2 * Math.PI, Math.min(2 * Math.PI, m.arc.sweep + d));
          const start = m.arc.sweep;
          const n = Math.max(1, Math.ceil((Math.abs(total - start) * c.r * z) / 3));
          const a0 = Math.atan2(pts[0][1] - c.cy, pts[0][0] - c.cx);
          for (let i = 1; i <= n; i++) {
            const t = a0 + start + ((total - start) * i) / n;
            pts.push([c.cx + c.r * Math.cos(t), c.cy + c.r * Math.sin(t), 0.5]);
          }
          m.arc.prev = a;
          m.arc.sweep = total;
          break;
        }
        const minD = 0.5 / z; // drop sub-pixel jitter: keeps getStroke cheap on long strokes
        for (const v of evs.length ? evs : [e]) {
          const p = penPoint(v, m.snap);
          const last = pts[pts.length - 1];
          if (Math.abs(p[0] - last[0]) < minD && Math.abs(p[1] - last[1]) < minD) continue;
          pts.push(p);
        }
        // Quick shapes: restart the hold timer whenever the pen really moves (not hand tremor)
        if (r.style.shapeSnap && draft.current.type === "pen" && !m.snap) {
          if (Math.hypot(e.clientX - m.anchor[0], e.clientY - m.anchor[1]) > 4) {
            m.anchor = [e.clientX, e.clientY];
            clearTimeout(holdTimer.current);
            holdTimer.current = setTimeout(trySnapShape, HOLD_MS);
          }
        }
        break;
      }
      case "lasso": {
        const L = lasso.current,
          last = L[L.length - 1];
        if (Math.hypot(wx - last[0], wy - last[1]) * z > 2) L.push([wx, wy]);
        break;
      }
      case "compass-set": {
        const c = compass.current;
        compass.current = { ...c, r: Math.hypot(wx - c.cx, wy - c.cy), ha: Math.atan2(wy - c.cy, wx - c.cx) };
        break;
      }
      case "compass-move":
        compass.current = { ...m.c0, cx: m.c0.cx + wx - m.sx, cy: m.c0.cy + wy - m.sy };
        break;
      case "guide-move": {
        const g = guides.current[m.g];
        if (g) guides.current[m.g] = { ...g, x: m.x0 + wx - m.sx, y: m.y0 + wy - m.sy };
        break;
      }
      case "guide-rotate": {
        const g = guides.current[m.g];
        if (g) guides.current[m.g] = { ...g, a: Guides.snapAngle(m.a0 + Math.atan2(wy - g.y, wx - g.x) - m.p0) };
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
        const ids = r.elements.filter((el) => !G.isLocked(el) && G.intersects(G.getBounds(el), box)).map((el) => el.id);
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
    if (ignoredPointers.current.delete(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const m = I.current;
    if (m.mode === "pinch") {
      if (pointers.current.size === 0) I.current = { mode: "idle" };
      return;
    }
    if (m.pid !== undefined && m.pid !== e.pointerId) return;
    clearTimeout(holdTimer.current);
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
        if (m.arc && Math.abs(m.arc.sweep) * compass.current.r * z < 4) break; // compass tap, no arc
        if (d) commit([...r.elements, d]);
        break;
      }
      case "lasso": {
        const poly = lasso.current;
        lasso.current = null;
        if (!poly || poly.length < 3) break;
        const ids = r.elements.filter((el) => !G.isLocked(el) && G.inLasso(el, poly)).map((el) => el.id);
        if (!ids.length) break;
        setTool("select");
        setSel(ids);
        break;
      }
      case "compass-set": {
        const c = compass.current;
        if (c.r * z < 8) {
          compass.current = null;
          showToast("Drag out from the centre to set the compass radius");
        }
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
        // partial erasing already changed the live elements; record it all as one undo step
        if (ids.size || r.elements !== m.before) commit(r.elements.filter((el) => !ids.has(el.id)), m.before);
        break;
      }
    }
    dirty.current = true;
  };

  const onDoubleClick = (e) => {
    if (R.current.tool !== "select") return;
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    const cover = topHit(wx, wy, ["cover"]);
    if (cover) {
      commit(R.current.elements.map((el) => (el.id === cover.id ? { ...el, revealed: !el.revealed } : el)));
      return showToast(cover.revealed ? "Answer hidden" : "Answer revealed (double-click to hide again)");
    }
    const hit = topHit(wx, wy, ["text", "sticky", ...RICH_TYPES]);
    if (hit) return RICH_TYPES.includes(hit.type) ? openRichEdit(hit) : startEdit(hit.id);
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
      if ("coverFill" in patch && t === "cover") u.fill = patch.coverFill;
      if ("strokeWidth" in patch && !["text", "sticky", "image"].includes(t)) u.strokeWidth = patch.strokeWidth;
      if ("strokeStyle" in patch && (G.isLinear(t) || G.isShape(t))) u.strokeStyle = patch.strokeStyle;
      if ("opacity" in patch) u.opacity = patch.opacity;
      if ("font" in patch && (t === "text" || t === "sticky")) u.font = patch.font;
      if ("fontSize" in patch && (t === "text" || t === "sticky")) u.fontSize = patch.fontSize;
      if ("codeFontSize" in patch && t === "code") u.fontSize = patch.codeFontSize;
      if ("codeTheme" in patch && t === "code") u.theme = patch.codeTheme;
      if ("lineNumbers" in patch && t === "code") u.lineNumbers = patch.lineNumbers;
      if ("mathSize" in patch && t === "math") u.fontSize = patch.mathSize;
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
  const uniquePageName = (name) => {
    const names = new Set(R.current.doc.pages.map((p) => p.name));
    let n = name;
    for (let i = 2; names.has(n); i++) n = `${name} ${i}`;
    return n;
  };
  /** Insert pages after the current one and show the first (a lone empty page is replaced). */
  const insertPages = (pages) => {
    finishEdit();
    setSel([]);
    pageCams.current[R.current.page.id] = camRef.current;
    setDoc((d) => {
      const keep = d.pages.length === 1 && !d.pages[0].elements.length ? [] : d.pages;
      const at = keep.findIndex((p) => p.id === d.current) + 1;
      return { ...d, pages: [...keep.slice(0, at), ...pages, ...keep.slice(at)], current: pages[0].id };
    });
    fitTo(pages[0].elements);
  };
  /** Go to a page; while presenting, each page is fitted to the screen like a slide. */
  const showPage = (id) => {
    switchPage(id);
    const p = R.current.doc.pages.find((x) => x.id === id);
    if (R.current.presenting && p?.elements.length) fitTo(p.elements);
  };
  const gotoPage = (delta) => {
    const pages = R.current.doc.pages;
    const next = pages[pages.findIndex((p) => p.id === R.current.page.id) + delta];
    if (next) showPage(next.id);
  };

  // ---------------------------------------------------------------- teaching
  const openRichEdit = (el) => {
    finishEdit();
    setRichEdit({ kind: el.type, id: el.id, initial: el });
  };
  const saveRichEdit = (values) => {
    const re = richEdit;
    setRichEdit(null);
    if (!re) return;
    const r = R.current;
    if (re.id) {
      commit(r.elements.map((el) => (el.id === re.id ? fitText({ ...el, ...values }) : el)));
      return setSel([re.id]);
    }
    const st = r.style;
    const isCode = re.kind === "code";
    if (isCode)
      setStyle((s) => ({ ...s, codeLanguage: values.language, codeTheme: values.theme, lineNumbers: values.lineNumbers }));
    const el = fitText({
      id: G.uid(),
      type: re.kind,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      ...(re.kind === "graph" && { w: GRAPH_DEFAULTS.w, h: GRAPH_DEFAULTS.h }),
      stroke: isCode ? INK : st.stroke,
      strokeWidth: re.kind === "graph" ? 3 : 1,
      opacity: 1,
      fontSize: isCode ? st.codeFontSize : st.mathSize,
      ...values,
      ...(r.presenting && { annot: true }),
    });
    const placed = { ...el, x: snapV(re.at[0] - el.w / 2), y: snapV(re.at[1] - el.h / 2) };
    commit([...r.elements, placed]);
    setToolState("select");
    R.current.tool = "select";
    setSel([placed.id]);
  };
  const insertTemplate = (t) => {
    setTemplatesOpen(false);
    finishEdit();
    const els = t.build();
    if (R.current.elements.length) {
      insertPages([{ ...Store.newPage(), name: uniquePageName(t.name), elements: els }]);
    } else {
      const b = G.unionBounds(els);
      const [cx, cy] = toWorld(window.innerWidth / 2, window.innerHeight / 2);
      const moved = els.map((el) => G.translate(el, cx - b.x - b.w / 2, cy - b.y - b.h / 2));
      commit(moved);
      fitTo(moved);
    }
    setToolState("select");
    R.current.tool = "select";
    showToast(`Added the "${t.name}" template`);
  };
  const importPdf = async (file) => {
    if (!file) return;
    showToast(`Opening ${file.name}…`);
    try {
      const { slides, total } = await pdfToSlides(file, {
        onProgress: (i, n) => showToast(`Importing slide ${i} of ${n}…`),
      });
      if (!slides.length) return showToast("That PDF has no pages");
      const title = file.name.replace(/\.pdf$/i, "").slice(0, 28) || "Slides";
      const pages = slides.map((sl, i) => {
        const h = (SLIDE_WIDTH * sl.h) / sl.w;
        return {
          ...Store.newPage(),
          name: `${title} · ${i + 1}`,
          // Locked so drawing over a slide can never move or erase it
          elements: [
            { id: G.uid(), type: "image", src: sl.src, x: -SLIDE_WIDTH / 2, y: -h / 2, w: SLIDE_WIDTH, h, opacity: 1, stroke: INK, strokeWidth: 1, locked: true },
          ],
        };
      });
      insertPages(pages);
      const mb = (JSON.stringify(R.current.doc).length + slides.reduce((n, sl) => n + sl.src.length, 0)) / 1e6;
      const parts = [`Imported ${slides.length} slide${slides.length > 1 ? "s" : ""}`];
      if (total > slides.length) parts.push(`(first ${MAX_PDF_PAGES} of ${total})`);
      if (user && mb > 12) parts.push(`· board is ~${Math.round(mb)} MB; cloud sync holds about 15 MB`);
      showToast(parts.join(" "));
    } catch (err) {
      console.error("PDF import failed:", err);
      showToast(pdfErrorMessage(err));
    }
  };
  const lockSelection = () => {
    const s = new Set(R.current.selected);
    if (!s.size) return;
    commit(R.current.elements.map((el) => (s.has(el.id) ? { ...el, locked: true } : el)));
    setSel([]);
    showToast("Locked. Menu → Unlock items on this page to edit them again");
  };
  const unlockPage = () => {
    const n = R.current.elements.filter(G.isLocked).length;
    if (!n) return showToast("Nothing is locked on this page");
    commit(R.current.elements.map((el) => (G.isLocked(el) ? { ...el, locked: false } : el)));
    showToast(`Unlocked ${n} item${n > 1 ? "s" : ""}`);
  };
  const clearAnnotations = () => {
    const n = R.current.elements.filter((el) => el.annot).length;
    if (!n) return;
    commit(R.current.elements.filter((el) => !el.annot));
    setSel([]);
    showToast(`Cleared ${n} annotation${n > 1 ? "s" : ""} (Ctrl+Z to undo)`);
  };
  const toggleSpotlight = () => {
    R.current.spotlight = !R.current.spotlight;
    setSpotlight(R.current.spotlight);
    dirty.current = true;
  };
  const startPresenting = () => {
    finishEdit();
    setSel([]);
    setOverview(false);
    setTemplatesOpen(false);
    R.current.presenting = true;
    setPresenting(true);
    // Every hidden answer starts covered again for the new run-through
    if (R.current.doc.pages.some((p) => p.elements.some((el) => el.type === "cover" && el.revealed)))
      setDoc((d) => ({
        ...d,
        pages: d.pages.map((p) =>
          p.elements.some((el) => el.type === "cover" && el.revealed)
            ? { ...p, elements: p.elements.map((el) => (el.type === "cover" ? { ...el, revealed: false } : el)) }
            : p,
        ),
      }));
    if (!document.fullscreenElement)
      document.documentElement
        .requestFullscreen?.()
        .then(() => (presentFullscreen.current = true))
        .catch(() => {});
    if (R.current.elements.length) fitTo(R.current.elements);
  };
  const stopPresenting = () => {
    R.current.presenting = false;
    R.current.spotlight = false;
    setPresenting(false);
    setSpotlight(false);
    if (presentFullscreen.current && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    presentFullscreen.current = false;
    dirty.current = true;
  };

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
  /** Lesson handout: every non-empty page as one PDF page. */
  const exportPDF = async () => {
    const { pages, dark } = R.current.doc;
    const filled = pages.filter((p) => p.elements.length);
    if (!filled.length) return showToast("Nothing to export yet");
    showToast("Building PDF…");
    try {
      const { jsPDF } = await import("jspdf");
      let pdf = null;
      for (let i = 0; i < filled.length; i++) {
        showToast(`Building PDF · page ${i + 1} of ${filled.length}…`);
        await preloadAssets(filled[i].elements, dark);
        const cv = renderToCanvas(filled[i].elements, { dark, scale: 1.5 });
        if (!cv) continue;
        const w = cv.width,
          h = cv.height,
          orientation = w >= h ? "landscape" : "portrait";
        if (!pdf) pdf = new jsPDF({ orientation, unit: "px", format: [w, h], hotfixes: ["px_scaling"], compress: true });
        else pdf.addPage([w, h], orientation);
        pdf.addImage(cv.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, w, h);
      }
      pdf.save(`lesson-${stamp()}.pdf`);
      showToast(`Exported ${filled.length} page${filled.length > 1 ? "s" : ""} as PDF`);
    } catch (err) {
      console.error("PDF export failed:", err);
      showToast("Could not build the PDF");
    }
  };
  const toggleRecording = async () => {
    if (recorder.current === "starting") return; // waiting on the microphone prompt
    if (recorder.current) {
      const rec = recorder.current;
      recorder.current = null;
      setRecording(null);
      const { blob, ext } = await rec.stop();
      Store.downloadBlob(blob, `lesson-${stamp()}.${ext}`);
      return showToast("Recording saved");
    }
    if (!canRecord()) return showToast("Recording isn't supported in this browser");
    try {
      recorder.current = "starting";
      showToast("Starting recording… allow the microphone to record your voice");
      const rec = await startRecording(canvasRef.current, { mic: true });
      recorder.current = rec;
      setRecording({ startedAt: Date.now(), mic: rec.mic });
      dirty.current = true; // make sure the first frame is captured
      showToast(rec.mic ? "Recording board + microphone" : "Recording board (no microphone access)");
    } catch (err) {
      recorder.current = null;
      console.error("Recording failed:", err);
      showToast("Could not start recording");
    }
  };
  /** Lock everything on the page so new ink can't move or erase it (a fixed background). */
  const lockPage = () => {
    const els = R.current.elements;
    const n = els.filter((el) => !G.isLocked(el)).length;
    if (!n) return showToast(els.length ? "Everything here is already locked" : "This page is empty");
    commit(els.map((el) => (G.isLocked(el) ? el : { ...el, locked: true })));
    setSel([]);
    showToast(`Locked ${n} item${n > 1 ? "s" : ""} as background · Menu → Unlock to edit them`);
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
    else if (a === "present") startPresenting();
    else if (a === "templates") setTemplatesOpen(true);
    else if (a === "pdf") filePdf.current?.click();
    else if (a === "overview") setOverview(true);
    else if (a === "timer") setTimerOpen((t) => !t);
    else if (a === "unlock") unlockPage();
    else if (a === "lockall") lockPage();
    else if (a === "pdfout") exportPDF();
    else if (a === "record") toggleRecording();
    else if (a === "share") setShareOpen(true);
    else if (a === "palm") setStyle((s) => ({ ...s, palmReject: !s.palmReject }));
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
      if (e.key === "F5" && !mod && !e.shiftKey) {
        e.preventDefault();
        if (!r.presenting) startPresenting();
        return;
      }
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
          setSel(r.elements.filter((el) => !G.isLocked(el)).map((el) => el.id));
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
        if (compass.current) {
          compass.current = null;
          dirty.current = true;
        }
        if (r.presenting && !r.selected.length) stopPresenting();
        return setSel([]);
      }
      if (r.presenting && (e.key.startsWith("Page") || !r.selected.length)) {
        if (PRESENT_NEXT.includes(e.key)) return (e.preventDefault(), gotoPage(1));
        if (PRESENT_PREV.includes(e.key)) return (e.preventDefault(), gotoPage(-1));
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
      if (k === "g") return setOverview((o) => !o);
      if (KEYMAP[k] && !e.shiftKey) setTool(KEYMAP[k]);
    },
    onFullscreenChange() {
      if (!document.fullscreenElement && presentFullscreen.current) {
        presentFullscreen.current = false;
        stopPresenting();
      }
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
      blur = () => (spaceDown.current = false),
      fs = () => api.current.onFullscreenChange();
    const cv = canvasRef.current;
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("paste", ps);
    window.addEventListener("blur", blur);
    document.addEventListener("fullscreenchange", fs);
    cv.addEventListener("wheel", wh, { passive: false });
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("paste", ps);
      window.removeEventListener("blur", blur);
      document.removeEventListener("fullscreenchange", fs);
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
    // While inking, the board under the stroke doesn't change: blit a snapshot instead of
    // redrawing every element each frame, so stroke latency doesn't grow with board size.
    const inking = I.current.mode === "draw" && draft.current;
    const sc = sceneCache.current;
    const fresh =
      inking &&
      sc.els === r.elements &&
      sc.cam === c &&
      sc.dark === dark &&
      sc.bg === r.doc.bg &&
      sc.presenting === r.presenting &&
      sc.canvas.width === cv.width &&
      sc.canvas.height === cv.height;
    if (fresh) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(sc.canvas, 0, 0);
    } else {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBackground(ctx, W, Hh, c, r.doc.bg, dark);

      ctx.setTransform(dpr * c.z, 0, 0, dpr * c.z, dpr * c.x, dpr * c.y);
      const view = { x: -c.x / c.z, y: -c.y / c.z, w: W / c.z, h: Hh / c.z };
      const er = erased.current;
      for (const el of r.elements) {
        if (!G.intersects(G.getBounds(el), view)) continue;
        drawElement(ctx, el, { dark, hideText: el.id === r.editing, ghost: er.has(el.id), presenting: r.presenting });
      }
      if (inking) {
        const off = sc.canvas;
        if (off.width !== cv.width || off.height !== cv.height) {
          off.width = cv.width;
          off.height = cv.height;
        }
        const octx = off.getContext("2d");
        octx.setTransform(1, 0, 0, 1, 0, 0);
        octx.clearRect(0, 0, off.width, off.height);
        octx.drawImage(cv, 0, 0);
        Object.assign(sc, { els: r.elements, cam: c, dark, bg: r.doc.bg, presenting: r.presenting });
      }
    }
    ctx.setTransform(dpr * c.z, 0, 0, dpr * c.z, dpr * c.x, dpr * c.y);
    if (draft.current) drawElement(ctx, draft.current, { dark, noCache: true });
    const mode = I.current.mode;
    for (const g of Object.values(guides.current))
      if (g) Guides.drawGuide(ctx, g, c.z, dark, { rotating: mode === "guide-rotate" && I.current.g === g.kind });
    if (r.tool === "compass") Guides.drawCompass(ctx, compass.current, c.z, dark);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = new Set(r.selected);
    drawSelectionUI(ctx, c, r.elements.filter((el) => s.has(el.id)), marquee.current, dark);

    // lasso path
    const L0 = lasso.current;
    if (L0 && L0.length > 1) {
      ctx.save();
      ctx.beginPath();
      L0.forEach(([x, y], i) => (i ? ctx.lineTo(x * c.z + c.x, y * c.z + c.y) : ctx.moveTo(x * c.z + c.x, y * c.z + c.y)));
      ctx.closePath();
      ctx.fillStyle = "rgba(105,101,219,0.08)";
      ctx.fill();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = "#6965db";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

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

    // spotlight: dim everything except a soft circle around the pointer
    if (r.spotlight && spotPos.current) {
      const [sx, sy] = spotPos.current;
      const rad = Math.max(90, Math.min(W, Hh) * 0.17);
      const g = ctx.createRadialGradient(sx, sy, rad * 0.82, sx, sy, rad * 1.08);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.72)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, Hh);
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
          setLiveCode(boardRes.whiteboard.shareCode || null);
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
    setLiveCode(null);
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
        coverFill: first.type === "cover" ? first.fill : style.coverFill,
        strokeWidth: first.strokeWidth ?? style.strokeWidth,
        strokeStyle: first.strokeStyle ?? style.strokeStyle,
        opacity: first.opacity ?? 1,
        font: first.font ?? style.font,
        fontSize: first.fontSize ?? style.fontSize,
        ...(TEXT_TYPES.includes(first.type)
          ? { bold: !!first.bold, italic: !!first.italic, underline: !!first.underline }
          : {}),
        ...(first.type === "code"
          ? { codeTheme: first.theme, codeFontSize: first.fontSize, lineNumbers: first.lineNumbers !== false }
          : {}),
        ...(first.type === "math" ? { mathSize: first.fontSize } : {}),
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
        else if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) importPdf(f);
        else if (f.name.endsWith(".json")) openFile(f);
        else showToast("Drop an image, a PDF or a board .json file");
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
      {!presenting && (
      <div className="ui-top fixed z-30 flex flex-wrap items-start gap-2 pointer-events-none">
        <div className="pointer-events-auto shrink-0 flex items-center gap-2">
          <TopMenu
            doc={doc}
            onAction={menuAction}
            user={user}
            onOpenAuth={() => setAuthOpen(true)}
            onLogout={handleLogout}
            cloudStatus={cloudStatus}
            palmReject={style.palmReject}
            recording={!!recording}
            live={!!liveCode}
          />
          {user ? (
            <div
              className="panel flex items-center gap-2.5 h-11 px-3.5 rounded-2xl text-xs font-medium text-zinc-700 dark:text-zinc-200 cursor-default"
              title={`Logged in as ${user.name} (${user.email}) - Isolated Whiteboard`}
            >
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden xl:block leading-tight text-left">
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
              <span className="hidden xl:inline whitespace-nowrap">Sign In / Cloud Sync</span>
            </button>
          )}
        </div>
        {/* Phones: own full-width row. Wider: fills the space between the side groups. */}
        <div className="order-last basis-full min-w-0 sm:order-none sm:basis-0 sm:flex-1">
          <Toolbar tool={tool} onTool={setTool} toggles={guideOn} />
        </div>
        <div className="pointer-events-auto shrink-0 ml-auto flex gap-2">
          {liveCode && (
            <button
              className="panel inline-flex items-center gap-2 h-11 px-3 rounded-2xl text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
              onClick={() => setShareOpen(true)}
              title="Students are watching live: show the link or stop sharing"
            >
              <Radio size={17} /> <span className="hidden lg:inline">Live</span>
            </button>
          )}
          <button
            className="panel inline-flex items-center gap-2 h-11 px-3 xl:px-4 rounded-2xl text-sm font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition"
            onClick={startPresenting}
            title="Present (F5): fullscreen, page-by-page, with spotlight and timer"
          >
            <Presentation size={17} /> <span className="hidden lg:inline">Present</span>
          </button>
          <button
            className="panel hidden xl:inline-flex items-center gap-2 h-11 px-4 rounded-2xl text-sm font-semibold text-white !bg-indigo-500 hover:!bg-indigo-600 transition"
            onClick={exportPNG}
            title="Export PNG (Ctrl+E)"
          >
            <ImageDown size={17} /> Export
          </button>
          <button className="panel icon-btn !w-11 !h-11 !hidden md:!inline-flex" title="Shortcuts (?)" aria-label="Keyboard shortcuts" onClick={() => setHelp(true)}>
            <HelpCircle size={19} />
          </button>
        </div>
      </div>
      )}

      {/* properties */}
      {showPanel && !presenting && (
        <div
          className="ui-below-header fixed left-[var(--ui-left)] z-20 flex flex-col items-start gap-2"
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
              onEditRich={selEls.length === 1 && RICH_TYPES.includes(selEls[0].type) ? () => openRichEdit(selEls[0]) : null}
              onLock={lockSelection}
            />
          )}
        </div>
      )}

      {/* bottom */}
      {!presenting && (
      <div className="ui-bottom fixed z-20 flex flex-col-reverse items-start sm:flex-row sm:items-end gap-2 pointer-events-none">
        <div className="pointer-events-auto shrink-0">
          <ZoomControls zoom={cam.z} onZoom={zoomCmd} onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} />
        </div>
        <div className="pointer-events-auto min-w-0 max-w-full lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:bottom-0">
          <PageTabs
            pages={doc.pages}
            current={page.id}
            onSelect={switchPage}
            onAdd={addPage}
            onRename={renamePage}
            onDelete={deletePage}
            onOverview={() => setOverview(true)}
          />
        </div>
        <div className="hidden xl:block ml-auto self-end text-xs text-zinc-400 bg-white/70 dark:bg-zinc-900/70 backdrop-blur px-3 py-1.5 rounded-full">
          {elements.length} item{elements.length === 1 ? "" : "s"} · Space-drag to pan · Ctrl+scroll to zoom · ? shortcuts
        </div>
      </div>
      )}

      {presenting && (
        <div className="fixed bottom-[var(--ui-bottom)] left-1/2 -translate-x-1/2 z-30 w-max max-w-[calc(100vw-1.5rem)]">
          <PresenterBar
            pageIndex={doc.pages.findIndex((p) => p.id === page.id)}
            pageCount={doc.pages.length}
            onPrev={() => gotoPage(-1)}
            onNext={() => gotoPage(1)}
            onOverview={() => setOverview(true)}
            tool={tool}
            onTool={setTool}
            color={style.stroke}
            onColor={(c) => applyStyle({ stroke: c })}
            dark={doc.dark}
            spotlight={spotlight}
            onSpotlight={toggleSpotlight}
            timerOpen={timerOpen}
            onTimer={() => setTimerOpen((t) => !t)}
            annotationCount={elements.filter((el) => el.annot).length}
            onClearAnnotations={clearAnnotations}
            recording={!!recording}
            onRecord={toggleRecording}
            onExit={stopPresenting}
          />
        </div>
      )}
      {recording && <RecordingPill startedAt={recording.startedAt} mic={recording.mic} onStop={toggleRecording} />}
      {timerOpen && (
        <div className={`fixed right-[var(--ui-right)] z-30 ${presenting ? "top-[var(--ui-top)]" : "ui-below-header"}`}>
          <ClassTimer onClose={() => setTimerOpen(false)} />
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed left-1/2 -translate-x-1/2 z-40 w-max max-w-[calc(100vw-2rem)] text-center px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm shadow-lg dark:bg-white dark:text-zinc-900 ${
            presenting ? "bottom-[calc(var(--ui-bottom)+6.5rem)]" : "ui-below-header"
          }`}
        >
          {toast}
        </div>
      )}
      {help && <HelpModal onClose={() => setHelp(false)} />}
      {richEdit?.kind === "graph" && (
        <GraphDialog initial={richEdit.initial} dark={doc.dark} onSave={saveRichEdit} onCancel={() => setRichEdit(null)} />
      )}
      {shareOpen && (
        <ShareDialog
          user={user}
          boardId={currentBoardId}
          code={liveCode}
          onCode={setLiveCode}
          onSignIn={() => {
            setShareOpen(false);
            setAuthOpen(true);
          }}
          onClose={() => setShareOpen(false)}
        />
      )}
      {richEdit && richEdit.kind !== "graph" && (
        <RichEditDialog
          kind={richEdit.kind}
          initial={richEdit.initial}
          dark={doc.dark}
          onSave={saveRichEdit}
          onCancel={() => setRichEdit(null)}
        />
      )}
      {templatesOpen && <TemplatePicker dark={doc.dark} onPick={insertTemplate} onClose={() => setTemplatesOpen(false)} />}
      {overview && (
        <PageOverview
          pages={doc.pages}
          current={page.id}
          dark={doc.dark}
          onSelect={(id) => {
            setOverview(false);
            showPage(id);
          }}
          onAdd={() => {
            setOverview(false);
            addPage();
          }}
          onClose={() => setOverview(false)}
        />
      )}
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
        ref={filePdf}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          importPdf(e.target.files?.[0]);
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
