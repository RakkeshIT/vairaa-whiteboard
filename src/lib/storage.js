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

export function loadDoc() {
  try {
    const d = JSON.parse(localStorage.getItem(DOC_KEY));
    if (!isValidDoc(d)) return null;
    if (!d.pages.some((p) => p.id === d.current)) d.current = d.pages[0].id;
    return d;
  } catch {
    return null;
  }
}

/** Returns false when the browser storage is full. */
export function saveDoc(doc) {
  try {
    localStorage.setItem(DOC_KEY, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
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
