import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function safeGit(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

function buildInfo() {
  const pkgPath = fileURLToPath(new URL("./package.json", import.meta.url));
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };

  // CI override first (shallow clones can undercount), then git, then fallback.
  const buildNumber =
    process.env.BUILD_NUMBER ||
    process.env.GITHUB_RUN_NUMBER ||
    safeGit("git rev-list --count HEAD") ||
    "0";

  const shortSha = safeGit("git rev-parse --short HEAD") || "unknown";
  const dirty = safeGit("git status --porcelain").length > 0;
  const sha = dirty ? `${shortSha}-dirty` : shortSha;

  return {
    version: pkg.version,
    buildNumber,
    sha,
    time: new Date().toISOString(),
  };
}

const info = buildInfo();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(info.version),
    __BUILD_NUMBER__: JSON.stringify(info.buildNumber),
    __BUILD_SHA__: JSON.stringify(info.sha),
    __BUILD_TIME__: JSON.stringify(info.time),
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5001/demo-confgo/us-central1/api",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
