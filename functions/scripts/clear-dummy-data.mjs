#!/usr/bin/env node
/**
 * Delete dummy data created by seed-dummy-data.mjs (and optionally the
 * imported conferences from import-conferences.mjs). Emulator by default.
 *
 * Usage:
 *   node functions/scripts/clear-dummy-data.mjs              # all seed_* docs + Auth
 *   node functions/scripts/clear-dummy-data.mjs --users-only # users + Auth, leave attendances/pings
 *   node functions/scripts/clear-dummy-data.mjs --confs-only # only the imported rc_* conferences
 *   node functions/scripts/clear-dummy-data.mjs --dry-run
 *   node functions/scripts/clear-dummy-data.mjs --production
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";

const args = process.argv.slice(2);
const PRODUCTION = args.includes("--production");
const DRY_RUN = args.includes("--dry-run");
const USERS_ONLY = args.includes("--users-only");
const CONFS_ONLY = args.includes("--confs-only");

if (USERS_ONLY && CONFS_ONLY) {
  console.error("Pass at most one of --users-only / --confs-only.");
  process.exit(1);
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

const BATCH_SIZE = 450;

// Range-query on doc ID covers every collection where seeded docs share a
// prefix: users (seed_*), attendances/pings/ping_contacts (seed_*__*), and
// conferences (rc_*).  is the conventional high-codepoint sentinel.
async function deletePrefix(db, collection, prefix) {
  const FieldPath = admin.firestore.FieldPath;
  let total = 0;

  if (DRY_RUN) {
    let lastDoc = null;
    while (true) {
      let q = db
        .collection(collection)
        .orderBy(FieldPath.documentId())
        .endAt(`${prefix}`)
        .limit(BATCH_SIZE);
      q = lastDoc ? q.startAfter(lastDoc) : q.startAt(prefix);
      const snap = await q.get();
      if (snap.empty) break;
      total += snap.size;
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < BATCH_SIZE) break;
    }
    console.log(`  ${collection}: would delete ${total}`);
    return total;
  }

  while (true) {
    const snap = await db
      .collection(collection)
      .orderBy(FieldPath.documentId())
      .startAt(prefix)
      .endAt(`${prefix}`)
      .limit(BATCH_SIZE)
      .get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    total += snap.size;
    console.log(`  ${collection}: deleted ${total}`);
    if (snap.size < BATCH_SIZE) break;
  }
  return total;
}

async function deleteAuthPrefix(auth, prefix) {
  let pageToken;
  let totalSeen = 0;
  let totalDeleted = 0;
  while (true) {
    const page = await auth.listUsers(1000, pageToken);
    const uids = page.users.map((u) => u.uid).filter((uid) => uid.startsWith(prefix));
    totalSeen += uids.length;
    if (uids.length > 0 && !DRY_RUN) {
      const res = await auth.deleteUsers(uids);
      totalDeleted += res.successCount;
      if (res.failureCount > 0) {
        console.warn(`  Auth: ${res.failureCount} delete failures`);
        for (const e of res.errors) console.warn(`    ${e.index}: ${e.error.message}`);
      }
    }
    if (!page.pageToken) break;
    pageToken = page.pageToken;
  }
  console.log(`  Auth: ${DRY_RUN ? `would delete ${totalSeen}` : `deleted ${totalDeleted}`}`);
}

async function main() {
  const projectId = await loadProjectId();
  if (!PRODUCTION) {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "localhost:8180";
    process.env.FIREBASE_AUTH_EMULATOR_HOST =
      process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "localhost:9099";
  }
  if (admin.apps.length === 0) admin.initializeApp({ projectId });
  const db = admin.firestore();
  const auth = admin.auth();

  const target = PRODUCTION ? "PRODUCTION" : "emulator";
  const tag = DRY_RUN ? " [dry-run]" : "";
  console.log(`Clearing dummy data on ${target} (project ${projectId})${tag}`);

  if (CONFS_ONLY) {
    await deletePrefix(db, "conferences", "rc_");
    console.log("Done.");
    return;
  }

  if (!USERS_ONLY) {
    await deletePrefix(db, "attendances", "seed_");
    await deletePrefix(db, "pings", "seed_");
    await deletePrefix(db, "ping_contacts", "seed_");
  }
  await deletePrefix(db, "users", "seed_");
  await deleteAuthPrefix(auth, "seed_");

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
