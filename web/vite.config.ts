import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8"),
) as { version: string; buildNumber?: number };

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

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "VITE_");
  if (command === "build" && mode === "production") {
    assertProductionEnvIsReal(env);
  }

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_BUILD__: JSON.stringify(pkg.buildNumber ?? 0),
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
