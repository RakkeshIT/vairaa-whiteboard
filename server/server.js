import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";
import { configureCors, corsOptions } from "./config/cors.js";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import whiteboardRoutes from "./routes/whiteboardRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas
connectDB();

// High-security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Don't conflict with client-side canvas blob URLs
  })
);

// Global Secure CORS Configuration
app.use(configureCors());

// Explicit handling for preflight OPTIONS requests on all routes
app.options("*", cors(corsOptions));

// Secondary CORS headers safeguard
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header("Access-Control-Allow-Credentials", "true");
  }
  next();
});

// Body parsers with generous limits for whiteboard canvas payloads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Rate limiting for OTP endpoints to protect against brute force / spam
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 15, // max 15 requests per 10 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification requests. Please wait a few minutes before trying again.",
  },
});

app.use("/api/auth/send-otp", otpLimiter);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "Vairaa Whiteboard Backend API",
    timestamp: new Date().toISOString(),
    corsConfigured: true,
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/whiteboard", whiteboardRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("[Unhandled Server Error]:", err.stack || err.message);

  if (err.message && err.message.includes("CORS")) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error occurred.",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Start listening
const server = app.listen(PORT, () => {
  console.log(`\n=======================================================`);
  console.log(`🚀 Vairaa Whiteboard Server running on port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🌐 CORS Allowed Origins: ${process.env.CLIENT_URL || "Default localhost + Vercel"}`);
  console.log(`=======================================================\n`);
});

export default app;

