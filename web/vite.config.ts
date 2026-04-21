import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared")
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5001",
        changeOrigin: true,
        rewrite: (requestPath) => `/demo-confgo/us-central1${requestPath}`
      }
    }
  }
});
