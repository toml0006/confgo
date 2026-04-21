#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { initFirebase } from "./_firebase.mjs";

const production = process.argv.includes("--production");
const dryRun = process.argv.includes("--dry-run");
const fileIndex = process.argv.indexOf("--file");
const filePath = fileIndex >= 0 ? process.argv[fileIndex + 1] : path.resolve("data/real-conferences.json");

const { db } = await initFirebase({ production });
const json = JSON.parse(await fs.readFile(filePath, "utf8"));
const chunks = [];

for (let index = 0; index < json.length; index += 500) {
  chunks.push(json.slice(index, index + 500));
}

let writes = 0;
for (const group of chunks) {
  const batch = db.batch();
  for (const conference of group) {
    const id = `rc_${crypto.createHash("sha256").update(`${conference.name.toLowerCase()}|${conference.startDate}`).digest("hex").slice(0, 16)}`;
    writes += 1;
    if (dryRun) {
      continue;
    }
    batch.set(db.collection("conferences").doc(id), {
      name: conference.name,
      location_name: conference.locationName,
      latitude: conference.latitude,
      longitude: conference.longitude,
      start_date: conference.startDate,
      end_date: conference.endDate,
      source: conference.source ?? "confs.tech",
      topics: conference.topics ?? [],
      url: conference.url ?? null,
      created_at: new Date().toISOString()
    }, { merge: true });
  }
  if (!dryRun) {
    await batch.commit();
  }
}

console.log(JSON.stringify({
  ok: true,
  dryRun,
  file: filePath,
  conferences: json.length,
  writes
}, null, 2));

