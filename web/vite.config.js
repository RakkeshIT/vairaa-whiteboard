import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // MathJax loads font files on demand that import its modules by path; pre-bundling would give
    // them a second copy of the font class in dev (production bundling is unaffected).
    exclude: ["@mathjax/src", "@mathjax/mathjax-newcm-font", "@mathjax/mathjax-mhchem-font-extension"],
    include: ["@mathjax/src > mhchemparser"],
  },
  server: {
    // Same-origin /api in dev (mirrors the Vercel rewrite) so auth cookies are first-party
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
