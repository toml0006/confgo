import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
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

// Guard: refuse to produce a production bundle with emulator / placeholder
// config. The symptom of slipping through is Firebase Auth throwing
// `auth/invalid-api-key` on first load in prod — silent at build time,
// blank-screen at runtime. Fail loudly here instead.
function assertProductionEnvIsReal(env: Record<string, string>) {
  const problems: string[] = [];
  if (env.VITE_USE_FIREBASE_EMULATORS === "true") {
    problems.push("VITE_USE_FIREBASE_EMULATORS is 'true'");
  }
  const apiKey = env.VITE_FIREBASE_API_KEY ?? "";
  if (!apiKey || /^(fake|test|dev|demo)/i.test(apiKey)) {
    problems.push(
      `VITE_FIREBASE_API_KEY looks unset or placeholder (${JSON.stringify(apiKey)})`,
    );
  }
  const projectId = env.VITE_FIREBASE_PROJECT_ID ?? "";
  if (projectId.startsWith("demo-")) {
    problems.push(
      `VITE_FIREBASE_PROJECT_ID starts with 'demo-' (${JSON.stringify(projectId)}) — ` +
        "Firebase reserves this prefix for emulator-only projects",
    );
  }
  if (problems.length > 0) {
    throw new Error(
      [
        "Refusing to build production bundle — config looks like local/emulator:",
        ...problems.map((p) => `  - ${p}`),
        "",
        "Create web/.env.production with real Firebase web config from",
        "  Firebase Console → Project Settings → Your apps → Web app → SDK config.",
        "See web/.env.production.example for the required keys.",
        "",
        "To build against emulator config on purpose, pass --mode development.",
      ].join("\n"),
    );
  }
}

const info = buildInfo();

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "VITE_");
  if (command === "build" && mode === "production") {
    assertProductionEnvIsReal(env);
  }

  return {
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
  };
});
