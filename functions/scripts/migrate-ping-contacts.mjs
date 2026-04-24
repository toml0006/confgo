#!/usr/bin/env node
/**
 * One-shot: split inline `pings/{id}.contacts` into `ping_contacts/{id}`.
 *
 * Why this exists:
 *   An earlier schema stored disclosures directly on the pings doc. After
 *   tightening Firestore rules (see firestore.rules), ping_contacts lives in
 *   its own collection with owner-only read access. Any pings doc that still
 *   carries an inline `contacts` field needs to be moved.
 *
 * Safety:
 *   - Dry run by default. Pass --apply to actually write/update anything.
 *   - --production required to target live Firestore; otherwise emulator.
 *   - Idempotent: reruns skip docs that have already been migrated.
 *
 * Usage:
 *   node functions/scripts/migrate-ping-contacts.mjs                 # dry-run, emulator
 *   node functions/scripts/migrate-ping-contacts.mjs --apply         # write, emulator
 *   node functions/scripts/migrate-ping-contacts.mjs --production --apply
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import admin from "firebase-admin";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);

const APPLY = flag("apply");
const PRODUCTION = flag("production");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const BATCH_MAX_PINGS = 250; // 2 ops per ping (set + update), ≤ 500 ops/batch

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

  console.log(`Target: ${PRODUCTION ? "PRODUCTION" : "emulator"} (project ${projectId})`);
  console.log(APPLY ? "Mode:   APPLY (will write)" : "Mode:   dry-run (no writes)");

  const snap = await db.collection("pings").get();
  console.log(`Scanning ${snap.size} pings docs…`);

  const toMigrate = []; // docs with inline contacts field
  const alreadyMigratedIds = new Set(); // ping_contacts already exists for these
  let skippedNoContacts = 0;

  for (const d of snap.docs) {
    const data = d.data();
    if (!Array.isArray(data.contacts)) {
      skippedNoContacts += 1;
      continue;
    }
    toMigrate.push(d);
  }

  if (toMigrate.length === 0) {
    console.log("Nothing to migrate.");
    console.log(`Summary: migrated=0, already=0, skipped=${skippedNoContacts}`);
    return;
  }

  // Check which already have a ping_contacts doc. If so we just need to
  // strip the inline field (the canonical data already lives elsewhere).
  const pcRefs = toMigrate.map((d) => db.collection("ping_contacts").doc(d.id));
  const pcDocs = await db.getAll(...pcRefs);
  for (const pc of pcDocs) {
    if (pc.exists) alreadyMigratedIds.add(pc.id);
  }

  const freshMigrations = toMigrate.filter((d) => !alreadyMigratedIds.has(d.id));
  const stripOnly = toMigrate.filter((d) => alreadyMigratedIds.has(d.id));

  // Basic sanity: every fresh migration must have from_user_id.
  const skippedMalformed = [];
  const migratable = [];
  for (const d of freshMigrations) {
    const data = d.data();
    if (typeof data.from_user_id !== "string") {
      skippedMalformed.push(d.id);
    } else {
      migratable.push(d);
    }
  }

  console.log(`  inline contacts found: ${toMigrate.length}`);
  console.log(`  fresh migrations:      ${migratable.length}`);
  console.log(`  strip-only (already):  ${stripOnly.length}`);
  if (skippedMalformed.length > 0) {
    console.log(`  SKIPPED malformed:     ${skippedMalformed.length}`);
    for (const id of skippedMalformed.slice(0, 10)) console.log(`    - ${id}`);
  }
  console.log(`  no inline contacts:    ${skippedNoContacts}`);

  if (!APPLY) {
    console.log("\nDry-run complete. Re-run with --apply to commit.");
    return;
  }

  let migratedWritten = 0;
  let strippedWritten = 0;

  const work = [...migratable, ...stripOnly];
  for (let i = 0; i < work.length; i += BATCH_MAX_PINGS) {
    const slice = work.slice(i, i + BATCH_MAX_PINGS);
    const batch = db.batch();
    for (const d of slice) {
      const alreadyMigrated = alreadyMigratedIds.has(d.id);
      if (!alreadyMigrated) {
        const data = d.data();
        batch.set(db.collection("ping_contacts").doc(d.id), {
          owner_id: data.from_user_id,
          contacts: data.contacts,
        });
        migratedWritten += 1;
      } else {
        strippedWritten += 1;
      }
      batch.update(d.ref, { contacts: admin.firestore.FieldValue.delete() });
    }
    await batch.commit();
    console.log(`  committed ${Math.min(i + slice.length, work.length)}/${work.length}`);
  }

  console.log(
    `\nDone. migrated=${migratedWritten}, stripped=${strippedWritten}, skipped_malformed=${skippedMalformed.length}, skipped_no_contacts=${skippedNoContacts}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
