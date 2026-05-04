#!/usr/bin/env node
/**
 * Summarize non-dummy users created in the last N days. Emulator by
 * default; `--production` reads project id from .firebaserc. Dummy users
 * are anything seeded by seed-dummy-data.mjs (id prefix `seed_`).
 *
 * Usage:
 *   node functions/scripts/summarize-new-users.mjs                # last 7 days, emulator
 *   node functions/scripts/summarize-new-users.mjs --days 30
 *   node functions/scripts/summarize-new-users.mjs --days 14 --production
 *   node functions/scripts/summarize-new-users.mjs --days 30 --json
 *   node functions/scripts/summarize-new-users.mjs --skip-anon       # drop users with no name AND no email
 */

import { promises as fs } from "node:fs";
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

const DAYS = Number(opt("days") ?? 7);
const PRODUCTION = flag("production");
const JSON_OUT = flag("json");
const SKIP_ANON = flag("skip-anon");

if (!Number.isFinite(DAYS) || DAYS <= 0) {
  console.error("--days must be a positive number");
  process.exit(1);
}

const TZ_NAME = Intl.DateTimeFormat().resolvedOptions().timeZone;
const pad2 = (n) => String(n).padStart(2, "0");
function localDate(iso) {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function localDateTime(iso) {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${localDate(iso)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

async function loadProjectId() {
  if (PRODUCTION) {
    const rc = JSON.parse(await fs.readFile(path.join(ROOT, ".firebaserc"), "utf8"));
    return rc.projects?.default ?? "demo-confgo";
  }
  return "demo-confgo";
}

async function main() {
  const projectId = await loadProjectId();
  if (!PRODUCTION) {
    process.env.FIRESTORE_EMULATOR_HOST =
      process.env.FIRESTORE_EMULATOR_HOST ?? "localhost:8180";
    process.env.FIREBASE_AUTH_EMULATOR_HOST =
      process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "localhost:9099";
  }
  if (admin.apps.length === 0) admin.initializeApp({ projectId });
  const db = admin.firestore();

  const cutoff = new Date(Date.now() - DAYS * 86_400_000);
  const cutoffIso = cutoff.toISOString();

  // created_at is ISO 8601, which sorts lexically — range query is safe.
  const snap = await db
    .collection("users")
    .where("created_at", ">=", cutoffIso)
    .orderBy("created_at", "desc")
    .get();

  const rows = [];
  let dummySkipped = 0;
  let anonSkipped = 0;
  for (const doc of snap.docs) {
    if (doc.id.startsWith("seed_")) {
      dummySkipped += 1;
      continue;
    }
    const d = doc.data();
    const displayName = d.display_name ?? null;
    const email = d.email ?? null;
    if (SKIP_ANON && !displayName && !email) {
      anonSkipped += 1;
      continue;
    }
    rows.push({
      id: doc.id,
      created_at: d.created_at ?? null,
      display_name: displayName,
      email,
    });
  }

  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        {
          target: PRODUCTION ? "production" : "emulator",
          project_id: projectId,
          window_days: DAYS,
          cutoff: cutoffIso,
          count: rows.length,
          dummy_skipped: dummySkipped,
          anon_skipped: anonSkipped,
          users: rows,
        },
        null,
        2,
      ),
    );
    return;
  }

  const target = PRODUCTION ? "production" : "emulator";
  console.log(`Target:    ${target} (${projectId})`);
  console.log(`Window:    last ${DAYS} day${DAYS === 1 ? "" : "s"} (since ${localDateTime(cutoffIso)} ${TZ_NAME})`);
  const skipNotes = [];
  if (dummySkipped) skipNotes.push(`${dummySkipped} dummy`);
  if (anonSkipped) skipNotes.push(`${anonSkipped} anon`);
  const skipSuffix = skipNotes.length ? `  (${skipNotes.join(", ")} skipped)` : "";
  console.log(`New users: ${rows.length}${skipSuffix}`);

  if (rows.length === 0) return;

  // Per-day histogram in local time, oldest → newest.
  const byDay = new Map();
  for (const r of rows) {
    const day = localDate(r.created_at);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  console.log(`\nBy day (${TZ_NAME}):`);
  for (const day of [...byDay.keys()].sort()) {
    console.log(`  ${day}  ${byDay.get(day)}`);
  }

  console.log(`\nUsers (newest first, ${TZ_NAME}):`);
  for (const r of rows) {
    const name = r.display_name ?? "(no name)";
    const email = r.email ?? "(no email)";
    console.log(`  ${localDateTime(r.created_at)}  ${r.id}  ${name} <${email}>`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
