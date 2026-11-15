import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Same-origin /api in dev (mirrors the Vercel rewrite) so auth cookies are first-party
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
