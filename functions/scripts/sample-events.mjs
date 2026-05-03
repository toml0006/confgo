#!/usr/bin/env node
/**
 * Push (or clear) sample documents in the global /events feed so the
 * LiveFeed component has something to animate without waiting on real
 * user activity. Documents written here carry `dummy: true` so the
 * `clear` verb can wipe just the synthetic ones, leaving any real
 * trigger-created events alone.
 *
 * Defaults to the emulator. Use --production for the live project
 * (reads project id from .firebaserc).
 *
 *   node functions/scripts/sample-events.mjs push                          # one match_added
 *   node functions/scripts/sample-events.mjs push --type=account_created
 *   node functions/scripts/sample-events.mjs push --burst=10               # ten random events
 *   node functions/scripts/sample-events.mjs push --conference "Minnebar 20"
 *   node functions/scripts/sample-events.mjs push --conf-id=rc_abc         # explicit doc id
 *   node functions/scripts/sample-events.mjs clear                         # delete all dummy:true events
 *   node functions/scripts/sample-events.mjs push --production --dry-run
 *
 * LiveFeed filter notes (mirrors web/src/hooks/useLiveFeed.ts):
 *   - account_created / account_deleted always show for any viewer.
 *   - match_added requires actor != viewer AND conf is in viewer's
 *     attendances OR shares a topic with the viewer. So if you're
 *     testing as a fresh anon user with no attendances, push
 *     account_created instead — match_added will silently filter out.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";

const args = process.argv.slice(2);
const verb = args[0];
function flag(name) {
  return args.includes(`--${name}`);
}
function opt(name) {
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return null;
  const cur = args[i];
  if (cur.includes("=")) return cur.slice(cur.indexOf("=") + 1);
  return args[i + 1] ?? null;
}

const PRODUCTION = flag("production");
const DRY_RUN = flag("dry-run");

if (verb !== "push" && verb !== "clear") {
  console.error("Usage: sample-events.mjs <push|clear> [flags]");
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

const VALID_TYPES = ["match_added", "account_created", "account_deleted"];
const FIRST = [
  "Rowan", "Imani", "Haru", "Sage", "Nico", "Emi", "Theo", "Mika", "Ola", "Noor",
  "Iris", "Leo", "Ada", "Cleo", "Finn", "Gus", "Hana", "Tess", "Kai", "Mira",
];
const LAST = [
  "Park", "Singh", "Morgan", "Vega", "Nilsson", "Khan", "Iwasaki", "Rios",
  "Barak", "Osei", "Lang", "Durand",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function syntheticActor() {
  const id = `sample_${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    displayName: `${pick(FIRST)} ${pick(LAST)}`,
    avatarId: Math.floor(Math.random() * 48),
    photoUrl: null,
  };
}

async function pushEvents(db) {
  const burst = Math.max(1, parseInt(opt("burst") ?? "1", 10));
  const requestedType = opt("type") ?? "match_added";
  if (!VALID_TYPES.includes(requestedType)) {
    console.error(`Unknown --type=${requestedType}. Valid: ${VALID_TYPES.join(", ")}`);
    process.exit(1);
  }
  const requestedConfId = opt("conf-id");
  const requestedConfName = opt("conference");

  // Preload a small pool of conferences for match_added picks. Skip when
  // we're only pushing account events.
  let confPool = [];
  if (requestedType === "match_added") {
    if (requestedConfId) {
      const snap = await db.collection("conferences").doc(requestedConfId).get();
      if (!snap.exists) {
        console.error(`Conference ${requestedConfId} not found.`);
        process.exit(1);
      }
      confPool = [{ id: snap.id, ...snap.data() }];
    } else if (requestedConfName) {
      // Resolve by name. Firestore has no case-insensitive operator, so
      // pull the recent slice and match in memory. Exact (case-insensitive)
      // match wins; otherwise fall back to a substring match so partial
      // names like "Minnebar" still resolve.
      const snap = await db
        .collection("conferences")
        .orderBy("start_date", "desc")
        .limit(2000)
        .get();
      const needle = requestedConfName.trim().toLowerCase();
      const allDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const exact = allDocs.find((c) => (c.name ?? "").toLowerCase() === needle);
      const partial =
        exact ??
        allDocs.find((c) => (c.name ?? "").toLowerCase().includes(needle));
      if (!partial) {
        console.error(`No conference matching "${requestedConfName}".`);
        process.exit(1);
      }
      confPool = [partial];
      if (!exact) {
        console.log(`Resolved "${requestedConfName}" → "${partial.name}" (${partial.id})`);
      }
    } else {
      const snap = await db
        .collection("conferences")
        .orderBy("start_date", "desc")
        .limit(80)
        .get();
      confPool = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (confPool.length === 0) {
        console.error(
          "No conferences in the database — run import-conferences first, or use --type=account_created.",
        );
        process.exit(1);
      }
    }
  }

  const now = new Date();
  const events = [];
  for (let i = 0; i < burst; i += 1) {
    const type = requestedType;
    const ts = new Date(now.getTime() + i * 50).toISOString(); // small spread so onSnapshot sees them in order
    const actor = syntheticActor();
    const base = {
      type,
      ts,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      actor,
      dummy: true,
    };
    if (type === "match_added") {
      const conf = pick(confPool);
      events.push({
        ...base,
        intent: Math.random() < 0.5 ? "going" : "been",
        conf: {
          id: conf.id,
          name: conf.name ?? "",
          locationName: conf.location_name ?? "",
          topics: conf.topics ?? [],
        },
      });
    } else {
      events.push(base);
    }
  }

  if (DRY_RUN) {
    console.log(`\n(dry run) would push ${events.length} event(s):\n`);
    for (const e of events) printEvent(e, null);
    return;
  }

  const events_col = db.collection("events");
  const refs = events.map(() => events_col.doc());
  const batch = db.batch();
  for (let i = 0; i < events.length; i += 1) batch.set(refs[i], events[i]);
  await batch.commit();
  console.log(`\npushed ${events.length} event(s) to /events:\n`);
  for (let i = 0; i < events.length; i += 1) {
    printEvent(events[i], refs[i].id);
  }
  console.log(""); // trailing newline
}

function printEvent(e, docId) {
  const tag =
    e.type === "match_added"
      ? `${e.intent.toUpperCase()} · ${e.conf.name}`
      : e.type;
  console.log(`  ${e.actor.displayName} → ${tag}`);
  console.log(`    type:    ${e.type}`);
  console.log(`    actor:   ${e.actor.id}  (avatar ${e.actor.avatarId})`);
  if (e.type === "match_added") {
    console.log(`    conf:    ${e.conf.id}  (${e.conf.locationName})`);
    console.log(
      `    topics:  ${e.conf.topics.length ? e.conf.topics.join(", ") : "(none)"}`,
    );
    console.log(`    intent:  ${e.intent}`);
  }
  console.log(`    ts:      ${e.ts}`);
  if (docId) console.log(`    docId:   events/${docId}`);
  console.log("");
}

async function clearEvents(db) {
  // Query the dummy slice. Firestore auto-indexes single-field equality
  // so no composite index is needed. Page in small batches so a large
  // accumulation of test events doesn't blow the 500-doc batch limit.
  const BATCH = 450;
  let total = 0;
  while (true) {
    const snap = await db
      .collection("events")
      .where("dummy", "==", true)
      .limit(BATCH)
      .get();
    if (snap.empty) break;
    if (DRY_RUN) {
      total += snap.size;
      console.log(`(dry run) would delete ${snap.size} event(s)`);
      // dry-run can't paginate via deletion; bail after the first page
      // so we don't loop forever showing the same count.
      break;
    }
    const batch = db.batch();
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
    total += snap.size;
    console.log(`  deleted ${total} so far…`);
  }
  console.log(
    DRY_RUN
      ? `(dry run) ${total}+ dummy events match.`
      : `cleared ${total} dummy event(s).`,
  );
}

async function main() {
  const projectId = await loadProjectId();
  if (!PRODUCTION) {
    process.env.FIRESTORE_EMULATOR_HOST =
      process.env.FIRESTORE_EMULATOR_HOST ?? "localhost:8180";
  }
  if (admin.apps.length === 0) admin.initializeApp({ projectId });
  const db = admin.firestore();

  console.log(`Target: ${PRODUCTION ? "production" : "emulator"} (${projectId})`);
  if (verb === "push") {
    await pushEvents(db);
  } else {
    await clearEvents(db);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
