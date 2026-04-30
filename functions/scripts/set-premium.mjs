#!/usr/bin/env node
/**
 * Toggle a conference's premium status and/or update its premium card
 * fields. Defaults to emulator. Use `--production` for live (reads
 * project id from .firebaserc).
 *
 * Provided fields are merged onto the doc — fields you omit keep their
 * previous values, so you can flip --off and back --on without losing
 * the sponsor's image/header/subtitle/body. Use --clear-<field> to
 * explicitly null a field.
 *
 * Usage:
 *   node functions/scripts/set-premium.mjs --id rc_abc --on
 *   node functions/scripts/set-premium.mjs --id rc_abc --off
 *   node functions/scripts/set-premium.mjs --id rc_abc --on \
 *       --image https://... --header "..." --subtitle "..." --body "..."
 *   node functions/scripts/set-premium.mjs --id rc_abc --header "..."
 *   node functions/scripts/set-premium.mjs --id rc_abc --clear-body
 *   node functions/scripts/set-premium.mjs --id rc_abc --on --production
 *   node functions/scripts/set-premium.mjs --id rc_abc --on --dry-run
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

const ID = opt("id");
const ON = flag("on");
const OFF = flag("off");
const PRODUCTION = flag("production");
const DRY_RUN = flag("dry-run");

const IMAGE = opt("image");
const HEADER = opt("header");
const SUBTITLE = opt("subtitle");
const BODY = opt("body");

const CLEAR_IMAGE = flag("clear-image");
const CLEAR_HEADER = flag("clear-header");
const CLEAR_SUBTITLE = flag("clear-subtitle");
const CLEAR_BODY = flag("clear-body");

if (!ID) {
  console.error("--id <conference_id> is required");
  process.exit(1);
}
if (ON && OFF) {
  console.error("--on and --off are mutually exclusive");
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

async function main() {
  const projectId = await loadProjectId();

  if (!PRODUCTION) {
    process.env.FIRESTORE_EMULATOR_HOST =
      process.env.FIRESTORE_EMULATOR_HOST ?? "localhost:8180";
    process.env.FIREBASE_AUTH_EMULATOR_HOST =
      process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "localhost:9099";
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
  }
  const db = admin.firestore();

  const ref = db.collection("conferences").doc(ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`conference ${ID} not found in project ${projectId}`);
    process.exit(1);
  }
  const before = snap.data();

  // Explicit sets win over --clear-<field> when both are passed.
  const update = {};
  if (ON) update.premium = true;
  if (OFF) update.premium = false;
  if (CLEAR_IMAGE) update.premium_image_url = null;
  if (CLEAR_HEADER) update.premium_header = null;
  if (CLEAR_SUBTITLE) update.premium_subtitle = null;
  if (CLEAR_BODY) update.premium_body = null;
  if (IMAGE !== null) update.premium_image_url = IMAGE;
  if (HEADER !== null) update.premium_header = HEADER;
  if (SUBTITLE !== null) update.premium_subtitle = SUBTITLE;
  if (BODY !== null) update.premium_body = BODY;

  if (Object.keys(update).length === 0) {
    console.log("nothing to do — pass --on / --off and/or content flags");
    return;
  }

  console.log(`Target:     ${PRODUCTION ? "production" : "emulator"} (${projectId})`);
  console.log(`Conference: ${before.name} (${ID})`);
  console.log("Before:", premiumView(before));
  console.log("Update:", update);

  if (DRY_RUN) {
    console.log("(dry run — no writes)");
    return;
  }

  await ref.set(update, { merge: true });
  const after = (await ref.get()).data();
  console.log("After: ", premiumView(after));
  console.log("Done.");
}

function premiumView(d) {
  return {
    premium: d?.premium ?? false,
    premium_image_url: d?.premium_image_url ?? null,
    premium_header: d?.premium_header ?? null,
    premium_subtitle: d?.premium_subtitle ?? null,
    premium_body: d?.premium_body ?? null,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
