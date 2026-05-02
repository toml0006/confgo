#!/usr/bin/env node
// Bumps the patch component of package.json's semver and increments
// buildNumber. Runs as the `prebuild` step, so every `npm run build`
// produces a fresh version+build pair. Dev runs (`npm run dev`) skip
// this — only releases bump.
//
// Also emits public/version.json with the current build number so the
// deployed page can poll it and self-refresh when a new build lands
// (used by ComingSoonPage to flip visitors to the live app on deploy).
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = fileURLToPath(new URL(".", import.meta.url));
const pkgPath = path.resolve(here, "..", "package.json");
const versionJsonPath = path.resolve(here, "..", "public", "version.json");

const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
const parts = String(pkg.version ?? "0.0.0").split(".").map((n) => parseInt(n, 10));
const [major = 0, minor = 0, patch = 0] = parts;
pkg.version = `${major}.${minor}.${patch + 1}`;
pkg.buildNumber = (pkg.buildNumber ?? 0) + 1;
await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

await fs.writeFile(
  versionJsonPath,
  JSON.stringify({ version: pkg.version, build: pkg.buildNumber }) + "\n",
);

console.log(`bumped: v${pkg.version} (build #${pkg.buildNumber})`);
