import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { connectDB } from "./db.js";
import { getOrigins } from "./cors.js";
import { User } from "../models/User.js";
import { Whiteboard } from "../models/Whiteboard.js";
import { sendOtpEmail } from "../utils/mailer.js";

// Better Auth shares the Mongoose connection (and its MongoDB driver) so there is one pool
const connection = await connectDB();

const OTP_EXPIRES_IN_SECONDS = 10 * 60;

// Per-email cap on OTP emails. Every send issues a fresh code with a fresh attempt counter,
// so without this an attacker rotating IPs could keep requesting codes to guess against.
const OTP_SENDS_PER_EMAIL = 5;
const OTP_SEND_WINDOW_MS = 15 * 60 * 1000;
const otpSendThrottle = connection.db.collection("otpSendThrottles");
await otpSendThrottle.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const isOtpSendAllowed = async (email) => {
  const windowStart = Math.floor(Date.now() / OTP_SEND_WINDOW_MS) * OTP_SEND_WINDOW_MS;
  const entry = await otpSendThrottle.findOneAndUpdate(
    { _id: `${email}:${windowStart}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + OTP_SEND_WINDOW_MS) } },
    { upsert: true, returnDocument: "after" }
  );
  return entry.count <= OTP_SENDS_PER_EMAIL;
};

// Comma-separated list of request headers that carry the real client IP (set by your proxy/host)
const ipAddressHeaders = (process.env.AUTH_IP_HEADERS || "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export const auth = betterAuth({
  appName: "Vairaa Whiteboard",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  basePath: "/api/auth",
  trustedOrigins: [
    ...getOrigins(),
    "https://vairaa-whiteboard*.vercel.app",
    // Mirror the CORS dev rule: any localhost port outside production
    ...(process.env.NODE_ENV !== "production" ? ["http://localhost:*", "http://127.0.0.1:*"] : []),
  ],

  // The app is passwordless: only OTP sign-in is used, so close the plugin's other OTP flows
  disabledPaths: [
    "/email-otp/check-verification-otp",
    "/email-otp/verify-email",
    "/email-otp/request-password-reset",
    "/forget-password/email-otp",
    "/email-otp/reset-password",
    "/email-otp/request-email-change",
    "/email-otp/change-email",
  ],

  // usePlural maps Better Auth's "user" model onto the existing Mongoose "users" collection,
  // so existing accounts and their whiteboard userId references keep working
  database: mongodbAdapter(connection.db, {
    client: connection.getClient(),
    usePlural: true,
  }),

  user: {
    additionalFields: {
      company: {
        type: "string",
        required: false,
        defaultValue: "",
        input: true,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Slide the expiry forward at most once a day
  },

  rateLimit: {
    // Stored in MongoDB so limits survive restarts and are shared across instances.
    // Enabled in production only (Better Auth default); per-route OTP limits come from the plugin.
    storage: "database",
  },

  advanced: {
    cookiePrefix: "vairaa",
    // Always Secure in production, even if BETTER_AUTH_URL is misconfigured as http
    useSecureCookies: process.env.NODE_ENV === "production",
    ...(ipAddressHeaders.length && { ipAddress: { ipAddressHeaders } }),
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/email-otp/send-verification-otp") return;
      const email = typeof ctx.body?.email === "string" ? ctx.body.email.trim().toLowerCase() : "";
      if (email && !(await isOtpSendAllowed(email))) {
        throw new APIError("TOO_MANY_REQUESTS", {
          code: "TOO_MANY_OTP_REQUESTS",
          message: "Too many verification codes requested for this email. Please try again in 15 minutes.",
        });
      }
    }),
  },

  databaseHooks: {
    user: {
      create: {
        // Email OTP sign-in auto-registers unknown emails; only allow it when registration details are supplied
        before: async (user) => {
          const name = typeof user.name === "string" ? user.name.trim() : "";
          const company = typeof user.company === "string" ? user.company.trim() : "";

          if (name.length < 2) {
            throw new APIError("BAD_REQUEST", {
              code: "REGISTRATION_DETAILS_REQUIRED",
              message: "No account exists for this email yet. Please create an account.",
            });
          }
          if (name.length > 100 || company.length > 120) {
            throw new APIError("BAD_REQUEST", {
              code: "INVALID_REGISTRATION_DETAILS",
              message: "Name must be at most 100 characters and company at most 120 characters.",
            });
          }

          return { data: { ...user, name, company } };
        },
        // Initialize the new user's personal whiteboard
        after: async (user) => {
          try {
            await Whiteboard.create({
              userId: user.id,
              title: `${user.name}'s Whiteboard`,
              isDefault: true,
            });
          } catch (error) {
            // GET /api/whiteboard lazily creates the board if this fails
            console.error("[Auth] Failed to create initial whiteboard:", error.message);
          }
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await User.updateOne({ _id: session.userId }, { lastLoginAt: new Date() }).catch(() => {});
        },
      },
    },
  },

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: OTP_EXPIRES_IN_SECONDS,
      allowedAttempts: 5,
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp, type }) {
        // Only passwordless sign-in / registration is used by this app
        if (type !== "sign-in") return;
        await sendOtpEmail(email, otp, OTP_EXPIRES_IN_SECONDS / 60);
      },
    }),
  ],
});
