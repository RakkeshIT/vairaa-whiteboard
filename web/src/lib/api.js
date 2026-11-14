const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const TOKEN_KEY = "vairaa_auth_token";
const USER_KEY = "vairaa_auth_user";

export const getAuthToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAuthSession = (token, user) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.error("Failed to store auth session:", e);
  }
};

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearAuthSession = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (e) {
    console.error("Failed to clear auth session:", e);
  }
};

/**
 * Universal fetch wrapper with automatic JWT header
 */
async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && token) {
      // Session has expired or is invalid
      clearAuthSession();
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
   AUTHENTICATION API
==================================================== */

export const authApi = {
  // Step 1: Send OTP to email
  sendOtp: async (email) => {
    return apiRequest("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  // Step 2: Verify OTP (with name & company if new user)
  verifyOtp: async ({ email, otp, name, company }) => {
    const data = await apiRequest("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp, name, company }),
    });

    if (data.token && data.user) {
      setAuthSession(data.token, data.user);
    }

    return data;
  },

  // Get current logged-in user profile
  getMe: async () => {
    return apiRequest("/auth/me");
  },

  logout: () => {
    clearAuthSession();
  },
};

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
};

