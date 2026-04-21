#!/usr/bin/env node

import { initFirebase } from "./_firebase.mjs";

const production = process.argv.includes("--production");
const usersOnly = process.argv.includes("--users-only");
const confsOnly = process.argv.includes("--confs-only");
const { auth, db } = await initFirebase({ production });

if (usersOnly || (!usersOnly && !confsOnly)) {
  for await (const user of listAllUsers(auth)) {
    if (user.uid.startsWith("seed_")) {
      await auth.deleteUser(user.uid);
    }
  }
}

if (!confsOnly) {
  await deleteCollection("attendances", (doc) => doc.id.startsWith("seed_att_"));
  await deleteCollection("pings", (doc) => doc.id.startsWith("seed_ping_"));
}

if (usersOnly || (!usersOnly && !confsOnly)) {
  await deleteCollection("users", (doc) => doc.id.startsWith("seed_"));
}

if (confsOnly || (!usersOnly && !confsOnly)) {
  await deleteCollection("conferences", (doc) => doc.id.startsWith("seed_conf_"));
}

console.log(JSON.stringify({
  ok: true,
  usersOnly,
  confsOnly
}, null, 2));

async function deleteCollection(name, predicate) {
  const snapshot = await db.collection(name).get();
  const docs = snapshot.docs.filter(predicate);
  for (let index = 0; index < docs.length; index += 500) {
    const batch = db.batch();
    for (const doc of docs.slice(index, index + 500)) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
}

async function* listAllUsers(auth) {
  let token;
  while (true) {
    const page = await auth.listUsers(1000, token);
    for (const user of page.users) {
      yield user;
    }
    if (!page.pageToken) {
      break;
    }
    token = page.pageToken;
  }
}
