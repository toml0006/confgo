#!/usr/bin/env node

import crypto from "node:crypto";

import { initFirebase, mulberry32 } from "./_firebase.mjs";

const production = process.argv.includes("--production");
const { auth, db } = await initFirebase({ production });

const rand = mulberry32(0x5eedc0de);
const seedUsers = [
  ["seed_annie", "Annie Case", "annie@example.com"],
  ["seed_omar", "Omar Vale", "omar@example.com"],
  ["seed_mika", "Mika Lin", "mika@example.com"],
  ["seed_rohan", "Rohan Das", "rohan@example.com"],
  ["seed_sadie", "Sadie Grant", "sadie@example.com"],
  ["seed_jules", "Jules Vega", "jules@example.com"],
  ["seed_noa", "Noa Hart", "noa@example.com"],
  ["seed_iris", "Iris West", "iris@example.com"],
  ["seed_kai", "Kai North", "kai@example.com"],
  ["seed_lee", "Lee Rowan", "lee@example.com"]
];

for (let index = seedUsers.length; index < 100; index += 1) {
  seedUsers.push([
    `seed_user_${String(index + 1).padStart(3, "0")}`,
    `Synthetic ${String(index + 1).padStart(3, "0")}`,
    null
  ]);
}

const conferenceSnapshots = await db.collection("conferences").get();
const conferences = conferenceSnapshots.docs.map((doc) => ({
  id: doc.id,
  latitude: doc.get("latitude"),
  longitude: doc.get("longitude")
}));

if (!conferences.length) {
  console.error("No conferences found. Run import-conferences first.");
  process.exit(1);
}

for (const [uid, displayName, email] of seedUsers) {
  try {
    await auth.getUser(uid);
  } catch {
    await auth.createUser({
      uid,
      displayName,
      email: email ?? undefined,
      password: email ? "seed-dev-password" : undefined
    });
  }

  await db.collection("users").doc(uid).set({
    avatar_id: Number(crypto.createHash("sha256").update(uid).digest("hex").slice(0, 2)) % 48,
    email,
    display_name: displayName,
    photo_url: null,
    created_at: new Date().toISOString()
  }, { merge: true });
}

const attendanceBatchChunks = [];
const attendanceDocs = [];
for (const [uid] of seedUsers) {
  const targetCount = 18 + Math.floor(rand() * 28);
  const chosen = new Set();
  while (chosen.size < Math.min(targetCount, conferences.length)) {
    const conference = conferences[Math.floor(rand() * conferences.length)];
    if (!conference) {
      break;
    }
    chosen.add(conference.id);
  }
  for (const conferenceId of chosen) {
    attendanceDocs.push({
      id: `seed_att_${crypto.createHash("sha256").update(`${uid}|${conferenceId}`).digest("hex").slice(0, 18)}`,
      user_id: uid,
      conference_id: conferenceId,
      intent: rand() > 0.45 ? "been" : "going",
      created_at: new Date(Date.now() - Math.floor(rand() * 200) * 24 * 60 * 60 * 1000).toISOString()
    });
  }
}

for (let index = 0; index < attendanceDocs.length; index += 500) {
  attendanceBatchChunks.push(attendanceDocs.slice(index, index + 500));
}

for (const chunk of attendanceBatchChunks) {
  const batch = db.batch();
  for (const attendance of chunk) {
    batch.set(db.collection("attendances").doc(attendance.id), attendance, { merge: true });
  }
  await batch.commit();
}

const pingPairs = [
  ["seed_annie", "seed_omar", null],
  ["seed_omar", "seed_annie", null],
  ["seed_mika", "seed_rohan", null],
  ["seed_sadie", "seed_jules", null],
  ["seed_jules", "seed_sadie", null],
  ["seed_noa", "seed_iris", null],
  ["seed_lee", "seed_kai", new Date().toISOString()],
  ["seed_kai", "seed_lee", null],
  ["seed_user_011", "seed_user_012", null]
];

const pingBatch = db.batch();
for (const [fromUserId, toUserId, rejectedAt] of pingPairs) {
  const id = `seed_ping_${crypto.createHash("sha256").update(`${fromUserId}|${toUserId}`).digest("hex").slice(0, 18)}`;
  pingBatch.set(db.collection("pings").doc(id), {
    from_user_id: fromUserId,
    to_user_id: toUserId,
    created_at: new Date(Date.now() - Math.floor(rand() * 20) * 24 * 60 * 60 * 1000).toISOString(),
    rejected_at: rejectedAt
  }, { merge: true });
}
await pingBatch.commit();

console.log(JSON.stringify({
  ok: true,
  users: seedUsers.length,
  attendances: attendanceDocs.length,
  pings: pingPairs.length
}, null, 2));

