#!/usr/bin/env node
/**
 * Seed 100 users + ~3500 attendances against conferences already present in Firestore.
 * Emulator by default. `--production` for live.
 *
 * Usage:
 *   node functions/scripts/seed-dummy-data.mjs
 *   node functions/scripts/seed-dummy-data.mjs --production
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";

const args = process.argv.slice(2);
const PRODUCTION = args.includes("--production");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

async function loadProjectId() {
  if (PRODUCTION) {
    const rc = JSON.parse(await fs.readFile(path.join(ROOT, ".firebaserc"), "utf8"));
    return rc.projects?.default ?? "demo-confgo";
  }
  return "demo-confgo";
}

// deterministic PRNG (mulberry32)
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x5eedc0de);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const NAMED_USERS = [
  { id: "seed_alex_stark", displayName: "Alex Stark", email: "alex@example.com" },
  { id: "seed_priya_rao", displayName: "Priya Rao", email: "priya@example.com" },
  { id: "seed_jordan_kim", displayName: "Jordan Kim", email: "jordan@example.com" },
  { id: "seed_sam_ortega", displayName: "Sam Ortega", email: "sam@example.com" },
  { id: "seed_lena_chen", displayName: "Lena Chen", email: "lena@example.com" },
  { id: "seed_devon_walsh", displayName: "Devon Walsh", email: "devon@example.com" },
  { id: "seed_mira_okafor", displayName: "Mira Okafor", email: "mira@example.com" },
  { id: "seed_ruby_vance", displayName: "Ruby Vance", email: "ruby@example.com" },
  { id: "seed_kai_lin", displayName: "Kai Lin", email: "kai@example.com" },
  { id: "seed_tess_moreno", displayName: "Tess Moreno", email: "tess@example.com" },
];

const FIRST = ["Rowan", "Imani", "Haru", "Sage", "Nico", "Emi", "Theo", "Mika", "Ola", "Noor", "Iris", "Leo", "Ada", "Ben", "Cleo", "Finn", "Gus", "Hana"];
const LAST = ["Park", "Singh", "Morgan", "Vega", "Nilsson", "Khan", "Iwasaki", "Rios", "Barak", "Osei", "Lang", "Durand"];

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

  // Load conferences once
  const confSnap = await db.collection("conferences").limit(2000).get();
  if (confSnap.empty) {
    console.error("No conferences found — run import-conferences.mjs first.");
    process.exit(1);
  }
  const conferences = confSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`Loaded ${conferences.length} conferences.`);

  // Build user list
  const users = [...NAMED_USERS];
  for (let i = 0; i < 90; i += 1) {
    const first = FIRST[Math.floor(rand() * FIRST.length)];
    const last = LAST[Math.floor(rand() * LAST.length)];
    users.push({
      id: `seed_u${String(i).padStart(3, "0")}`,
      displayName: `${first} ${last}`,
      email: null,
    });
  }

  console.log(`Seeding ${users.length} users…`);
  const now = new Date().toISOString();
  for (const u of users) {
    try {
      await auth.getUser(u.id);
    } catch {
      await auth.createUser({
        uid: u.id,
        email: u.email ?? undefined,
        password: u.email ? "seed-dev-password" : undefined,
        displayName: u.displayName,
      });
    }
    await db.collection("users").doc(u.id).set(
      {
        avatar_id: Math.floor(rand() * 48),
        email: u.email,
        display_name: u.displayName,
        photo_url: null,
        created_at: now,
      },
      { merge: true },
    );
  }

  console.log("Seeding attendances…");
  let written = 0;
  let batch = db.batch();
  let pending = 0;
  for (const user of users) {
    // each user attends 20–60 conferences
    const target = 20 + Math.floor(rand() * 40);
    const picks = new Set();
    while (picks.size < target && picks.size < conferences.length) {
      picks.add(Math.floor(rand() * conferences.length));
    }
    for (const idx of picks) {
      const conf = conferences[idx];
      const now = Date.now();
      const confStart = new Date(conf.start_date).getTime();
      const intent = confStart > now ? (rand() < 0.5 ? "going" : "been") : "been";
      const id = `${user.id}__${conf.id}`;
      batch.set(db.collection("attendances").doc(id), {
        user_id: user.id,
        conference_id: conf.id,
        intent,
        created_at: new Date().toISOString(),
      });
      pending += 1;
      written += 1;
      if (pending >= 450) {
        await batch.commit();
        console.log(`  committed ${written} attendances`);
        batch = db.batch();
        pending = 0;
      }
    }
  }
  if (pending > 0) {
    await batch.commit();
    console.log(`  committed ${written} attendances`);
  }
  console.log(`Seed complete. ${users.length} users, ${written} attendances.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
