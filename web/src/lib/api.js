import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

// Relative by default: /api is proxied to the backend (Vite in dev, Vercel rewrites in prod),
// so the httpOnly session cookie is first-party
const API_BASE = import.meta.env.VITE_API_URL || "/api";

/* ====================================================
   AUTHENTICATION (Better Auth, email OTP + cookie session)
==================================================== */

export const authClient = createAuthClient({
  baseURL: new URL(`${API_BASE}/auth`, window.location.origin).href,
  plugins: [emailOTPClient()],
});

/**
 * Universal fetch wrapper; the session cookie is sent automatically
 */
async function apiRequest(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      // Session has expired or was revoked
      window.dispatchEvent(new CustomEvent("vairaa:auth-expired"));
    }
    const error = new Error(data.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

/* ====================================================
   WHITEBOARD API (Per-User Storage & Isolation)
==================================================== */

export const whiteboardApi = {
  // Load current user's active personal whiteboard
  loadBoard: async () => {
    return apiRequest("/whiteboard");
  },

  // Save current user's personal whiteboard
  saveBoard: async (doc, title, whiteboardId) => {
    return apiRequest("/whiteboard", {
      method: "PUT",
      body: JSON.stringify({ doc, title, whiteboardId }),
    });
  },

  // List all boards belonging to this user
  listBoards: async () => {
    return apiRequest("/whiteboard/list");
  },

  // Create a new board for this user
  newBoard: async (title) => {
    return apiRequest("/whiteboard/new", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  },

  // Delete a board
  deleteBoard: async (id) => {
    return apiRequest(`/whiteboard/${id}`, {
      method: "DELETE",
    });
  },

  // Start a read-only live view for students; returns { code }
  share: async (whiteboardId) => {
    return apiRequest("/whiteboard/share", {
      method: "POST",
      body: JSON.stringify({ whiteboardId }),
    });
  },

  // Stop the live view (the old link stops working)
  unshare: async (whiteboardId) => {
    return apiRequest("/whiteboard/share", {
      method: "DELETE",
      body: JSON.stringify({ whiteboardId }),
    });
  },
};

/* ====================================================
   LIVE VIEW (public, read-only; students need no account)
==================================================== */

export const liveApi = {
  /** Current page of a shared board, or { unchanged: true } when nothing changed since `since`. */
  get: async (code, since) => {
    const q = since ? `?since=${encodeURIComponent(since)}` : "";
    const res = await fetch(`${API_BASE}/live/${encodeURIComponent(code)}${q}`, { cache: "no-store" });
    if (res.status === 404) {
      const err = new Error("This live view has ended");
      err.status = 404;
      throw err;
    }
    if (!res.ok) throw new Error(`Live view request failed (${res.status})`);
    return res.json();
  },
  /** URL of an image on a shared board (served separately so polls stay small). */
  assetUrl: (code, pageId, elId) =>
    `${API_BASE}/live/${encodeURIComponent(code)}/asset/${encodeURIComponent(pageId)}/${encodeURIComponent(elId)}`,
};

