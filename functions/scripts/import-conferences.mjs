#!/usr/bin/env node
/**
 * Read functions/data/real-conferences.json and batch-upsert into Firestore.
 * Defaults to emulator. Use `--production` for live (reads project id from .firebaserc).
 *
 * Usage:
 *   node functions/scripts/import-conferences.mjs
 *   node functions/scripts/import-conferences.mjs --file path/to/other.json
 *   node functions/scripts/import-conferences.mjs --dry-run
 *   node functions/scripts/import-conferences.mjs --production
 */

import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import admin from "firebase-admin";

const args = process.argv.slice(2);
function flag(name) {
  return args.includes(`--${name}`);
}
function opt(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
}

const DRY_RUN = flag("dry-run");
const PRODUCTION = flag("production");
const FILE = opt("file");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

async function loadProjectId() {
  if (PRODUCTION) {
    const rc = JSON.parse(await fs.readFile(path.join(ROOT, ".firebaserc"), "utf8"));
    return rc.projects?.default ?? "demo-confgo";
  }
  return "demo-confgo";
}

function stableId(name, startDate) {
  // Hash on the calendar date (YYYY-MM-DD) rather than the full ISO so
  // re-imports across collectors/eras with different time-of-day encodings
  // collide onto a single doc instead of producing sibling drifters.
  const day = String(startDate).slice(0, 10);
  const h = crypto.createHash("sha256");
  h.update(`${name.toLowerCase()}|${day}`);
  return `rc_${h.digest("hex").slice(0, 16)}`;
}

async function main() {
  const projectId = await loadProjectId();
  const filePath = FILE
    ? path.resolve(process.cwd(), FILE)
    : path.resolve(__dirname, "..", "data", "real-conferences.json");

  if (!PRODUCTION) {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "localhost:8180";
    process.env.FIREBASE_AUTH_EMULATOR_HOST =
      process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "localhost:9099";
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
  }
  const db = admin.firestore();

  const raw = JSON.parse(await fs.readFile(filePath, "utf8"));
  console.log(`Read ${raw.length} conferences from ${filePath}`);
  console.log(`Target: ${PRODUCTION ? "production" : "emulator"} (project ${projectId})`);
  if (DRY_RUN) console.log("(dry run — no writes)");

  const now = new Date().toISOString();
  const docs = raw.map((c) => {
    const data = {
      name: c.name,
      location_name: c.location_name,
      latitude: c.latitude,
      longitude: c.longitude,
      start_date: c.start_date,
      end_date: c.end_date,
      source: c.source ?? "confs.tech",
      topics: c.topics ?? [],
      url: c.url ?? null,
      created_at: now,
    };
    if (c.online === true) data.online = true;
    return { id: stableId(c.name, c.start_date), data };
  });

  if (DRY_RUN) {
    console.log("sample:", docs.slice(0, 2));
    return;
  }

  const BATCH = 500;
  for (let i = 0; i < docs.length; i += BATCH) {
    const slice = docs.slice(i, i + BATCH);
    const batch = db.batch();
    for (const d of slice) {
      batch.set(db.collection("conferences").doc(d.id), d.data, { merge: true });
    }
    await batch.commit();
    console.log(`  committed ${Math.min(i + BATCH, docs.length)}/${docs.length}`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
