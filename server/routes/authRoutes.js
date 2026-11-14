import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Otp } from "../models/Otp.js";
import { Whiteboard } from "../models/Whiteboard.js";
import { sendOtpEmail } from "../utils/mailer.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Generate random 6-digit numeric OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * @route   POST /api/auth/send-otp
 * @desc    Send 6-digit verification code to user email (checks if existing or new)
 */
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email format.",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: cleanEmail });
    const isExistingUser = Boolean(existingUser);

    // Remove any previous active OTPs for this email
    await Otp.deleteMany({ email: cleanEmail });

    // Generate fresh 6-digit OTP valid for 10 minutes
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.create({
      email: cleanEmail,
      otp,
      expiresAt,
    });

    // Send code via email
    const mailResult = await sendOtpEmail(cleanEmail, otp);

    return res.status(200).json({
      success: true,
      message: isExistingUser
        ? `Welcome back! Verification code sent to ${cleanEmail}.`
        : `Verification code sent to ${cleanEmail}. Please enter your details to register.`,
      isExistingUser,
      // Provide devOtp when in development or when SMTP is not configured for rapid testing
      devOtp: mailResult.devMode ? otp : undefined,
    });
  } catch (error) {
    console.error("[Auth Error] send-otp failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send verification code. Please try again.",
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP: Logs in existing user, or registers new user with name & company
 */
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp, name, company } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and verification code are required.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    // Verify OTP against database
    const otpRecord = await Otp.findOne({
      email: cleanEmail,
      otp: cleanOtp,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code. Please request a new code.",
      });
    }

    // Check if user exists
    let user = await User.findOne({ email: cleanEmail });
    let isNewUser = false;

    if (!user) {
      // New user registration requires name
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          needsRegistrationDetails: true,
          message: "Please provide your name (at least 2 characters) to create your account.",
        });
      }

      user = await User.create({
        email: cleanEmail,
        name: name.trim(),
        company: company ? String(company).trim() : "",
        lastLoginAt: new Date(),
      });

      isNewUser = true;

      // Automatically create the user's initial default personal whiteboard
      await Whiteboard.create({
        userId: user._id,
        title: `${user.name}'s Whiteboard`,
        isDefault: true,
        doc: {
          pages: [
            {
              id: "page-1",
              name: "Page 1",
              elements: [],
            },
          ],
          current: "page-1",
          bg: "grid",
          dark: false,
          snap: false,
        },
      });
    } else {
      // Existing user: update last login and optionally update company/name if sent
      user.lastLoginAt = new Date();
      if (name && typeof name === "string" && name.trim().length >= 2) {
        user.name = name.trim();
      }
      if (company !== undefined) {
        user.company = String(company).trim();
      }
      await user.save();
    }

    // Consume the OTP
    await Otp.deleteMany({ email: cleanEmail });

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
      },
      process.env.JWT_SECRET || "vairaa_whiteboard_super_secret_jwt_key_2026_secure",
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "30d",
      }
    );

    return res.status(200).json({
      success: true,
      message: isNewUser
        ? `Account successfully created! Welcome, ${user.name}.`
        : `Welcome back, ${user.name}!`,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        company: user.company,
      },
      isNewUser,
    });
  } catch (error) {
    console.error("[Auth Error] verify-otp failed:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication verification failed.",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated user profile
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-__v");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        company: user.company,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user profile.",
      error: error.message,
    });
  }
});

export default router;

