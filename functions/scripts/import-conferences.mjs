#!/usr/bin/env node
// Imports conferences from functions/data/real-conferences.json (or --file <path>) into Firestore.
// Defaults to emulator; pass --production to target the real project.
// Idempotent: doc ids are SHA-256(name|startDate) so re-runs overwrite the same docs.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseArgs,
  loadProjectId,
  initAdmin,
  getFirestore,
} from "./lib/admin.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = parseArgs(process.argv);
const isProduction = args.flags.has("production");
const dryRun = args.flags.has("dry-run");
const filePath =
  args.opts.file || join(__dirname, "..", "data", "real-conferences.json");

const projectId = loadProjectId(isProduction);
initAdmin({ isProduction, projectId });
const db = getFirestore();

const raw = readFileSync(filePath, "utf-8");
const records = JSON.parse(raw);
console.log(`Loaded ${records.length} conference records from ${filePath}`);
console.log(`Target: ${isProduction ? `production (${projectId})` : "emulator"}`);
if (dryRun) console.log("DRY RUN — no writes");

let written = 0;
let batch = db.batch();
const nowIso = new Date().toISOString();

for (let i = 0; i < records.length; i++) {
  const r = records[i];
  const hash = createHash("sha256")
    .update(`${String(r.name).toLowerCase()}|${r.startDate}`)
    .digest("hex")
    .slice(0, 16);
  const id = `rc_${hash}`;
  const doc = {
    name: r.name,
    location_name: r.locationName,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    start_date: r.startDate,
    end_date: r.endDate,
    source: "confs.tech",
    topics: Array.isArray(r.topics) ? r.topics : [],
    url: r.url ?? null,
    created_at: nowIso,
  };
  if (!dryRun) {
    batch.set(db.collection("conferences").doc(id), doc);
  }
  written++;
  if (written % 500 === 0) {
    if (!dryRun) await batch.commit();
    batch = db.batch();
    console.log(`  committed ${written}/${records.length}`);
  }
}

if (!dryRun && written % 500 !== 0) {
  await batch.commit();
}

console.log(`Done. Wrote ${written} conference docs.`);
process.exit(0);
