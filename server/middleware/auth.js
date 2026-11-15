import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";

export const requireAuth = async (req, res, next) => {
  try {
    // Validates the httpOnly session cookie against the sessions collection
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please sign in.",
      });
    }

    req.user = {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      company: session.user.company,
    };

    next();
  } catch (error) {
    console.error("[Auth Error] Session validation failed:", error.message);
    return res.status(401).json({
      success: false,
      message: "Invalid authentication credentials.",
    });
  }
};
