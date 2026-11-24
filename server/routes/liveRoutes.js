import express from "express";
import { Whiteboard } from "../models/Whiteboard.js";

// Public, read-only live view of a shared board (students need no account).
// Students poll GET /:code about once a second, so:
//   - an unchanged board costs one tiny indexed lookup (updatedAt only),
//   - only the teacher's current page is sent,
//   - embedded images (PDF slides, photos) are swapped for asset ids and served once, cached.
const router = express.Router();

const CODE_RE = /^[A-Za-z0-9_-]{8,32}$/;
// Per-instance cache of recently served boards, keyed by share code
const cache = new Map();
const CACHE_MAX = 20;

async function loadDoc(code) {
  const meta = await Whiteboard.findOne({ shareCode: code }).select("updatedAt").lean();
  if (!meta) return null;
  const hit = cache.get(code);
  if (hit && hit.updatedAt.getTime() === meta.updatedAt.getTime()) return hit;
  const board = await Whiteboard.findOne({ shareCode: code }).select("title doc updatedAt").lean();
  if (!board) return null;
  const entry = { title: board.title, doc: board.doc, updatedAt: board.updatedAt };
  cache.delete(code);
  cache.set(code, entry);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return entry;
}

const isDataUrl = (s) => typeof s === "string" && s.startsWith("data:");

/**
 * @route   GET /api/live/:code?since=<ISO date>
 * @desc    Current page of a shared board, or { unchanged: true } if nothing changed since `since`
 */
router.get("/:code", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { code } = req.params;
    if (!CODE_RE.test(code)) return res.status(404).json({ success: false, message: "Live view not found." });

    const since = req.query.since ? new Date(req.query.since) : null;
    if (since && !Number.isNaN(since.getTime())) {
      const meta = await Whiteboard.findOne({ shareCode: code }).select("updatedAt").lean();
      if (!meta) return res.status(404).json({ success: false, message: "Live view not found." });
      if (meta.updatedAt.getTime() <= since.getTime()) return res.json({ unchanged: true });
    }

    const entry = await loadDoc(code);
    if (!entry) return res.status(404).json({ success: false, message: "Live view not found." });
    const pages = Array.isArray(entry.doc?.pages) ? entry.doc.pages : [];
    const pageIndex = Math.max(0, pages.findIndex((p) => p.id === entry.doc.current));
    const page = pages[pageIndex] || { id: "none", name: "Page", elements: [] };

    return res.json({
      updatedAt: entry.updatedAt.toISOString(),
      title: entry.title,
      bg: entry.doc.bg || "grid",
      dark: !!entry.doc.dark,
      pageIndex,
      pageCount: pages.length,
      page: {
        id: page.id,
        name: page.name,
        elements: (page.elements || []).map((el) =>
          el?.type === "image" && isDataUrl(el.src) ? { ...el, src: undefined, asset: el.id } : el,
        ),
      },
    });
  } catch (error) {
    console.error("[Live Error] Failed to load live view:", error);
    return res.status(500).json({ success: false, message: "Failed to load the live view." });
  }
});

/**
 * @route   GET /api/live/:code/asset/:pageId/:elId
 * @desc    One embedded image from a shared board (immutable per element id → long cache)
 */
router.get("/:code/asset/:pageId/:elId", async (req, res) => {
  try {
    const { code, pageId, elId } = req.params;
    if (!CODE_RE.test(code)) return res.status(404).end();
    const entry = await loadDoc(code);
    const page = entry?.doc?.pages?.find((p) => p.id === pageId);
    const el = page?.elements?.find((e) => e?.id === elId && e.type === "image");
    const m = el && /^data:([\w.+-]+\/[\w.+-]+)?(;base64)?,(.*)$/s.exec(el.src);
    if (!m || !/^image\//.test(m[1] || "")) return res.status(404).end();
    const body = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]));
    res.set("Content-Type", m[1]);
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.set("X-Content-Type-Options", "nosniff");
    return res.send(body);
  } catch (error) {
    console.error("[Live Error] Failed to load asset:", error);
    return res.status(500).end();
  }
});

export default router;
