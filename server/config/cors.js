import cors from "cors";

// Parse configured origins from environment
const getOrigins = () => {
  const envOrigins = (process.env.CLIENT_URL || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const defaultOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "https://vairaa-whiteboard.vercel.app",
  ];

  return Array.from(new Set([...defaultOrigins, ...envOrigins]));
};

export const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = getOrigins();

    // Check exact match
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow Vercel preview deploys for this project
    const isVercelPreview = /^https:\/\/.*vairaa.*\.vercel\.app$/.test(origin);
    if (isVercelPreview) {
      return callback(null, true);
    }

    // In local development, allow any localhost/127.0.0.1 port
    if (process.env.NODE_ENV !== "production") {
      const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (isLocalhost) {
        return callback(null, true);
      }
    }

    // Origin rejected
    return callback(
      new Error(`CORS blocked: Origin ${origin} is not allowed by CORS policy.`),
      false
    );
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "x-client-version",
  ],
  exposedHeaders: ["Content-Length", "X-Request-Id"],
  credentials: true,
  maxAge: 86400, // 24 hours preflight cache
  optionsSuccessStatus: 204,
};

export const configureCors = () => cors(corsOptions);

