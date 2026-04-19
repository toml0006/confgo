#!/usr/bin/env node
// Seeds 100 users + ~3,500 attendances + a handful of pings.
// Deterministic via a seeded PRNG so re-runs produce the same result.

import { parseArgs, loadProjectId, initAdmin, getFirestore, getAuth } from "./lib/admin.mjs";

const args = parseArgs(process.argv);
const isProduction = args.flags.has("production");
const projectId = loadProjectId(isProduction);
initAdmin({ isProduction, projectId });
const db = getFirestore();
const auth = getAuth();

// deterministic mulberry32 PRNG
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
const randInt = (n) => Math.floor(rand() * n);
const pick = (arr) => arr[randInt(arr.length)];

const NAMED = [
  { id: "seed_ava", email: "ava@seed.confgo.dev", displayName: "Ava Ritchie", admin: true },
  { id: "seed_ben", email: "ben@seed.confgo.dev", displayName: "Ben Ortega", admin: false },
  { id: "seed_cora", email: "cora@seed.confgo.dev", displayName: "Cora Yildiz", admin: false },
  { id: "seed_dev", email: "dev@seed.confgo.dev", displayName: "Dev Raman", admin: false },
  { id: "seed_elena", email: "elena@seed.confgo.dev", displayName: "Elena Park", admin: false },
  { id: "seed_finn", email: "finn@seed.confgo.dev", displayName: "Finn O'Connor", admin: false },
  { id: "seed_gita", email: "gita@seed.confgo.dev", displayName: "Gita Varma", admin: false },
  { id: "seed_hugo", email: "hugo@seed.confgo.dev", displayName: "Hugo Delacroix", admin: false },
  { id: "seed_iris", email: "iris@seed.confgo.dev", displayName: "Iris Tanaka", admin: false },
  { id: "seed_jae", email: "jae@seed.confgo.dev", displayName: "Jae Nguyen", admin: false },
];

const FIRST = ["Alex", "Riley", "Jordan", "Sam", "Taylor", "Casey", "Jules", "Morgan", "Robin", "Sky"];
const LAST = ["Lang", "Kim", "Patel", "Stone", "Reyes", "Novak", "Blake", "Fuentes", "Okafor", "Vega"];

console.log(`Seeding users + attendances + pings into ${isProduction ? `production (${projectId})` : "emulator"}`);

// 1) Auth + user docs
const allUserIds = [];
for (const u of NAMED) {
  allUserIds.push(u.id);
  try {
    await auth.createUser({
      uid: u.id,
      email: u.email,
      displayName: u.displayName,
      password: "seed-dev-password",
    });
  } catch (e) {
    if (!String(e.message).includes("already exists")) throw e;
    await auth.updateUser(u.id, {
      email: u.email,
      displayName: u.displayName,
      password: "seed-dev-password",
    });
  }
  await db.collection("users").doc(u.id).set({
    avatar_id: randInt(48),
    email: u.email,
    display_name: u.displayName,
    photo_url: null,
    is_admin: !!u.admin,
    created_at: new Date().toISOString(),
  });
}

for (let i = 0; i < 90; i++) {
  const id = `seed_u${String(i).padStart(3, "0")}`;
  allUserIds.push(id);
  const displayName = `${pick(FIRST)} ${pick(LAST)}`;
  try {
    await auth.createUser({ uid: id, displayName });
  } catch (e) {
    if (!String(e.message).includes("already exists")) throw e;
  }
  await db.collection("users").doc(id).set({
    avatar_id: randInt(48),
    email: null,
    display_name: displayName,
    photo_url: null,
    is_admin: false,
    created_at: new Date().toISOString(),
  });
}
console.log(`  created ${allUserIds.length} users`);

// 2) Attendances
const confsSnap = await db.collection("conferences").get();
const conferences = confsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
if (!conferences.length) {
  console.error("No conferences found. Run import-conferences first.");
  process.exit(1);
}

let attendanceCount = 0;
let batch = db.batch();
const nowIso = new Date().toISOString();

for (const userId of allUserIds) {
  const howMany = 12 + randInt(40); // 12–51 per user
  const picked = new Set();
  while (picked.size < howMany && picked.size < conferences.length) {
    picked.add(randInt(conferences.length));
  }
  for (const idx of picked) {
    const conf = conferences[idx];
    const intent = Date.parse(conf.end_date) < Date.now() ? "been" : "going";
    const docId = `${userId}_${conf.id}`;
    batch.set(db.collection("attendances").doc(docId), {
      user_id: userId,
      conference_id: conf.id,
      intent,
      created_at: nowIso,
    });
    attendanceCount++;
    if (attendanceCount % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
}
await batch.commit();
console.log(`  created ${attendanceCount} attendances`);

// 3) Pings: 4 mutual, 3 one-way, 2 rejected
const pingPlan = [
  { from: "seed_ava", to: "seed_ben", rejected: false },
  { from: "seed_ben", to: "seed_ava", rejected: false }, // mutual
  { from: "seed_cora", to: "seed_dev", rejected: false },
  { from: "seed_dev", to: "seed_cora", rejected: false }, // mutual
  { from: "seed_elena", to: "seed_finn", rejected: false }, // one-way
  { from: "seed_gita", to: "seed_hugo", rejected: false }, // one-way
  { from: "seed_iris", to: "seed_jae", rejected: false }, // one-way
  { from: "seed_u000", to: "seed_u001", rejected: true },
  { from: "seed_u002", to: "seed_u003", rejected: true },
];
const pingBatch = db.batch();
for (const p of pingPlan) {
  const id = `${p.from}_${p.to}`;
  pingBatch.set(db.collection("pings").doc(id), {
    from_user_id: p.from,
    to_user_id: p.to,
    created_at: nowIso,
    rejected_at: p.rejected ? nowIso : null,
  });
}
await pingBatch.commit();
console.log(`  created ${pingPlan.length} pings`);

console.log("Done.");
process.exit(0);
