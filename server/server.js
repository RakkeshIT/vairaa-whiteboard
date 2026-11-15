// Must be the first import: ES module imports run before this file's body,
// and config/auth.js connects to MongoDB as soon as it is imported
import "dotenv/config";

import express from "express";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth.js";
import { configureCors, corsOptions } from "./config/cors.js";
import cors from "cors";

import whiteboardRoutes from "./routes/whiteboardRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

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

// Better Auth (OTP sign-in/registration, sessions, sign-out, rate limiting).
// Must be mounted before express.json() so it can read the raw request body.
app.all("/api/auth/*", toNodeHandler(auth));

// Body parsers with generous limits for whiteboard canvas payloads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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

