import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token missing or invalid format. Please log in.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided.",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "vairaa_whiteboard_super_secret_jwt_key_2026_secure"
    );

    // Verify user still exists in database
    const user = await User.findById(decoded.userId).select("-__v");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User session is no longer valid. User does not exist.",
      });
    }

    req.user = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      company: user.company,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please log in again.",
        expired: true,
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid authentication credentials.",
    });
  }
};

