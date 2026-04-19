#!/usr/bin/env node
// Deletes all seed_* docs from Firestore and Auth accounts.
// Flags: --users-only, --confs-only, --production

import { parseArgs, loadProjectId, initAdmin, getFirestore, getAuth } from "./lib/admin.mjs";

const args = parseArgs(process.argv);
const isProduction = args.flags.has("production");
const usersOnly = args.flags.has("users-only");
const confsOnly = args.flags.has("confs-only");

const projectId = loadProjectId(isProduction);
initAdmin({ isProduction, projectId });
const db = getFirestore();
const auth = getAuth();

console.log(`Clearing seed data in ${isProduction ? `production (${projectId})` : "emulator"}`);

async function deleteSeedDocs(collection, prefix = "seed_") {
  const snap = await db.collection(collection).get();
  let deleted = 0;
  let batch = db.batch();
  for (const d of snap.docs) {
    if (!d.id.startsWith(prefix) && !containsSeedRef(d.data())) continue;
    batch.delete(d.ref);
    deleted++;
    if (deleted % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();
  console.log(`  deleted ${deleted} docs from ${collection}`);
}

function containsSeedRef(data) {
  if (!data) return false;
  if (typeof data.user_id === "string" && data.user_id.startsWith("seed_")) return true;
  if (typeof data.from_user_id === "string" && data.from_user_id.startsWith("seed_")) return true;
  if (typeof data.to_user_id === "string" && data.to_user_id.startsWith("seed_")) return true;
  return false;
}

if (!confsOnly) {
  await deleteSeedDocs("attendances");
  await deleteSeedDocs("pings");
  await deleteSeedDocs("users");

  // delete Auth users with seed_ prefix
  let next;
  let deleted = 0;
  do {
    const list = await auth.listUsers(1000, next);
    next = list.pageToken;
    const seedUids = list.users.filter((u) => u.uid.startsWith("seed_")).map((u) => u.uid);
    if (seedUids.length) {
      const res = await auth.deleteUsers(seedUids);
      deleted += res.successCount;
    }
  } while (next);
  console.log(`  deleted ${deleted} auth users`);
}

if (!usersOnly) {
  // Conferences don't use seed_ prefix — this is a clear-all for real imports.
  // Only run with --confs-only.
  if (confsOnly) {
    const snap = await db.collection("conferences").get();
    let batch = db.batch();
    let deleted = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref);
      deleted++;
      if (deleted % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    await batch.commit();
    console.log(`  deleted ${deleted} conferences`);
  }
}

console.log("Done.");
process.exit(0);
