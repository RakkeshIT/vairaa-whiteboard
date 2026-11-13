import { uid } from "./elements";

const DOC_KEY = "pro-whiteboard:doc:v2";
const STYLE_KEY = "pro-whiteboard:style:v2";

export const newPage = (n = 1) => ({ id: uid(), name: `Page ${n}`, elements: [] });
export const newDoc = () => {
  const p = newPage(1);
  return { pages: [p], current: p.id, bg: "grid", dark: false, snap: false };
};

export function isValidDoc(d) {
  return (
    d &&
    Array.isArray(d.pages) &&
    d.pages.length > 0 &&
    d.pages.every((p) => p && typeof p.id === "string" && Array.isArray(p.elements))
  );
}

const fixCurrent = (d) => (d.pages.some((p) => p.id === d.current) ? d : { ...d, current: d.pages[0].id });

/** Fast synchronous copy (localStorage) — used for the very first paint. */
export function loadDoc() {
  try {
    const d = JSON.parse(localStorage.getItem(DOC_KEY));
    return isValidDoc(d) ? fixCurrent(d) : null;
  } catch {
    return null;
  }
}

// ---- IndexedDB: holds far more than localStorage (~5 MB), so boards with images never stop saving.
const DB_NAME = "pro-whiteboard";
const STORE = "kv";
let dbPromise = null;
function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error("IndexedDB unavailable"));
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}
async function idb(mode, fn) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => res(req?.result);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}

/** Identifies this browser tab, so other tabs can pick up its saves. */
export const TAB_ID = uid();
export const REV_KEY = "pro-whiteboard:rev";

/** Newest valid copy from IndexedDB or localStorage. */
export async function loadDocAsync() {
  let fromDb = null;
  try {
    fromDb = await idb("readonly", (s) => s.get("doc"));
  } catch {
    /* fall back to localStorage */
  }
  const copies = [fromDb, loadDoc()].filter(isValidDoc).map(fixCurrent);
  copies.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return copies[0] || null;
}

function writeLocal(d) {
  try {
    localStorage.setItem(DOC_KEY, JSON.stringify(d));
    return true;
  } catch {
    // Too big for localStorage: drop the stale copy so it can never win over IndexedDB.
    try {
      localStorage.removeItem(DOC_KEY);
    } catch {
      /* ignore */
    }
    return false;
  }
}
function signalTabs() {
  try {
    localStorage.setItem(REV_KEY, JSON.stringify({ tab: TAB_ID, t: Date.now() }));
  } catch {
    /* ignore */
  }
}

/** Save to both stores. Resolves false only if neither store accepted the board. */
export async function persistDoc(doc) {
  const d = { ...doc, savedAt: Date.now() };
  const local = writeLocal(d);
  let db = false;
  try {
    await idb("readwrite", (s) => s.put(d, "doc"));
    db = true;
  } catch {
    /* ignore */
  }
  signalTabs();
  return local || db;
}

/** Synchronous best-effort save for page close / reload (IndexedDB write is fire-and-forget). */
export function persistDocNow(doc) {
  const d = { ...doc, savedAt: Date.now() };
  writeLocal(d);
  idb("readwrite", (s) => s.put(d, "doc")).catch(() => {});
}

export function loadStyle() {
  try {
    return JSON.parse(localStorage.getItem(STYLE_KEY)) || {};
  } catch {
    return {};
  }
}
export function saveStyle(s) {
  try {
    localStorage.setItem(STYLE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function download(href, name) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  download(url, name);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const readFileAsText = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsText(file);
  });

/** Read an image file and downscale it so the board stays small enough for localStorage. */
export function loadImageFile(file, max = 1600) {
  return new Promise((res, rej) => {
    if (!file || !file.type.startsWith("image/")) return rej(new Error("Not an image"));
    const r = new FileReader();
    r.onerror = () => rej(r.error);
    r.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error("Could not read image"));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * k)),
          h = Math.max(1, Math.round(img.height * k));
        if (k === 1 && file.size < 400_000) return res({ src: r.result, w, h });
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        const type = file.type === "image/png" || file.type === "image/gif" ? "image/png" : "image/jpeg";
        res({ src: cv.toDataURL(type, 0.85), w, h });
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
