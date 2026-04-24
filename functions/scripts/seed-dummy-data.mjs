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
  {
    id: "seed_alex_stark",
    displayName: "Alex Stark",
    email: "alex@example.com",
    savedContacts: [
      { type: "email", value: "alex@example.com" },
      { type: "twitter", value: "alexstark" },
      { type: "github", value: "alexs" },
    ],
  },
  {
    id: "seed_priya_rao",
    displayName: "Priya Rao",
    email: "priya@example.com",
    savedContacts: [
      { type: "email", value: "priya@example.com" },
      { type: "linkedin", value: "priyarao" },
      { type: "website", value: "priyarao.dev" },
    ],
  },
  {
    id: "seed_jordan_kim",
    displayName: "Jordan Kim",
    email: "jordan@example.com",
    savedContacts: [
      { type: "email", value: "jordan@example.com" },
      { type: "instagram", value: "jordankim" },
    ],
  },
  {
    id: "seed_sam_ortega",
    displayName: "Sam Ortega",
    email: "sam@example.com",
    savedContacts: [
      { type: "email", value: "sam@example.com" },
      { type: "phone", value: "+1 415 555 0123" },
      { type: "tiktok", value: "samortega" },
    ],
  },
  {
    id: "seed_lena_chen",
    displayName: "Lena Chen",
    email: "lena@example.com",
    savedContacts: [
      { type: "email", value: "lena@example.com" },
      { type: "twitter", value: "lenachen" },
      { type: "github", value: "lchen" },
    ],
  },
  {
    id: "seed_devon_walsh",
    displayName: "Devon Walsh",
    email: "devon@example.com",
    savedContacts: [
      { type: "email", value: "devon@example.com" },
      { type: "linkedin", value: "devonwalsh" },
      { type: "website", value: "devonwalsh.me" },
    ],
  },
  {
    id: "seed_mira_okafor",
    displayName: "Mira Okafor",
    email: "mira@example.com",
    savedContacts: [
      { type: "email", value: "mira@example.com" },
      { type: "instagram", value: "miraok" },
      { type: "twitter", value: "miraok" },
    ],
  },
  {
    id: "seed_ruby_vance",
    displayName: "Ruby Vance",
    email: "ruby@example.com",
    savedContacts: [
      { type: "email", value: "ruby@example.com" },
      { type: "github", value: "rubyv" },
      { type: "website", value: "rubyvance.io" },
    ],
  },
  {
    id: "seed_kai_lin",
    displayName: "Kai Lin",
    email: "kai@example.com",
    savedContacts: [
      { type: "email", value: "kai@example.com" },
      { type: "linkedin", value: "kailin" },
      { type: "phone", value: "+1 212 555 0199" },
    ],
  },
  {
    id: "seed_tess_moreno",
    displayName: "Tess Moreno",
    email: "tess@example.com",
    savedContacts: [
      { type: "email", value: "tess@example.com" },
      { type: "instagram", value: "tessmoreno" },
      { type: "tiktok", value: "tessm" },
    ],
  },
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
      savedContacts: [],
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
        saved_contacts: u.savedContacts ?? [],
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

  console.log("Seeding pings…");
  // Emulator-only: wipe any stale pings/ping_contacts before re-seeding so
  // previously created in-session pings (rejected, dematched, ping-back'd,
  // or pre-split inline-contacts docs) don't mix with the deterministic
  // seed set. Guarded so we never wipe production.
  if (!PRODUCTION) {
    for (const coll of ["pings", "ping_contacts"]) {
      const snap = await db.collection(coll).get();
      if (snap.empty) continue;
      const wipeBatch = db.batch();
      for (const d of snap.docs) wipeBatch.delete(d.ref);
      await wipeBatch.commit();
      console.log(`  wiped ${snap.size} stale ${coll}`);
    }
  }
  const usersById = new Map(users.map((u) => [u.id, u]));
  const pickContacts = (userId, n) => {
    const saved = usersById.get(userId)?.savedContacts ?? [];
    return saved.slice(0, Math.min(n, saved.length));
  };
  const daysAgoIso = (d) => new Date(Date.now() - d * 86_400_000).toISOString();
  // PDD: 3 mutual pairs (6 docs) + 2 one-way + 1 rejected = 9 ping records.
  const pingPlan = [
    // mutual: alex ↔ priya
    { from: "seed_alex_stark", to: "seed_priya_rao", daysAgo: 4, contacts: 2 },
    { from: "seed_priya_rao", to: "seed_alex_stark", daysAgo: 3, contacts: 2 },
    // mutual: jordan ↔ sam
    { from: "seed_jordan_kim", to: "seed_sam_ortega", daysAgo: 10, contacts: 2 },
    { from: "seed_sam_ortega", to: "seed_jordan_kim", daysAgo: 9, contacts: 2 },
    // mutual: lena ↔ devon
    { from: "seed_lena_chen", to: "seed_devon_walsh", daysAgo: 1, contacts: 3 },
    { from: "seed_devon_walsh", to: "seed_lena_chen", daysAgo: 1, contacts: 2 },
    // one-way (unanswered)
    { from: "seed_mira_okafor", to: "seed_ruby_vance", daysAgo: 2, contacts: 2 },
    { from: "seed_kai_lin", to: "seed_tess_moreno", daysAgo: 6, contacts: 2 },
    // rejected
    {
      from: "seed_ruby_vance",
      to: "seed_kai_lin",
      daysAgo: 14,
      contacts: 2,
      rejectedDaysAgo: 12,
    },
  ];
  let pingBatch = db.batch();
  for (const p of pingPlan) {
    const id = `${p.from}__${p.to}`;
    pingBatch.set(db.collection("pings").doc(id), {
      from_user_id: p.from,
      to_user_id: p.to,
      created_at: daysAgoIso(p.daysAgo),
      rejected_at: p.rejectedDaysAgo != null ? daysAgoIso(p.rejectedDaysAgo) : null,
    });
    pingBatch.set(db.collection("ping_contacts").doc(id), {
      owner_id: p.from,
      contacts: pickContacts(p.from, p.contacts),
    });
  }
  await pingBatch.commit();
  console.log(`  committed ${pingPlan.length} pings + ${pingPlan.length} disclosures`);

  console.log(`Seed complete. ${users.length} users, ${written} attendances, ${pingPlan.length} pings.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
