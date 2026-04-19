import { Hono } from "hono";
import { optionalAuth, requireAuth, requireLinked } from "../middleware/auth";
import { db } from "../lib/firestore";
import {
  decayCutoffISO,
  decayDays,
  pingIntensity,
  serializeUserSummary,
} from "../lib/serialize";
import { conflict, forbidden, notFound, rateLimited } from "../lib/errors";
import type { HonoVars, PingDoc, UserDoc } from "../lib/types";

export const pingRoutes = new Hono<HonoVars>();

pingRoutes.use("*", optionalAuth);

const RATE_HOUR = Math.max(1, Number(process.env.PING_RATE_LIMIT_HOUR) || 10);
const RATE_DAY = Math.max(1, Number(process.env.PING_RATE_LIMIT_DAY) || 50);

async function sendPing(fromUid: string, targetId: string): Promise<void> {
  if (fromUid === targetId) throw forbidden("You cannot ping yourself.");

  const target = await db.collection("users").doc(targetId).get();
  if (!target.exists) throw notFound("User not found.");

  const pingId = `${fromUid}_${targetId}`;
  const existingRef = db.collection("pings").doc(pingId);
  const existing = await existingRef.get();

  if (existing.exists) {
    const d = existing.data() as PingDoc;
    if (d.rejected_at) {
      const ageDays = (Date.now() - Date.parse(d.rejected_at)) / 86_400_000;
      if (ageDays < decayDays()) {
        throw conflict("Recipient has declined this ping recently.");
      }
    }
  }

  const now = Date.now();
  const hourAgo = new Date(now - 3_600_000).toISOString();
  const dayAgo = new Date(now - 86_400_000).toISOString();

  const hourCount = (
    await db
      .collection("pings")
      .where("from_user_id", "==", fromUid)
      .where("created_at", ">=", hourAgo)
      .count()
      .get()
  ).data().count;
  if (hourCount >= RATE_HOUR) {
    throw rateLimited(
      3600,
      `Rate limit: max ${RATE_HOUR} pings per hour.`
    );
  }
  const dayCount = (
    await db
      .collection("pings")
      .where("from_user_id", "==", fromUid)
      .where("created_at", ">=", dayAgo)
      .count()
      .get()
  ).data().count;
  if (dayCount >= RATE_DAY) {
    throw rateLimited(
      86400,
      `Rate limit: max ${RATE_DAY} pings per day.`
    );
  }

  const doc: PingDoc = {
    from_user_id: fromUid,
    to_user_id: targetId,
    created_at: new Date(now).toISOString(),
    rejected_at: null,
  };
  await existingRef.set(doc);
}

// POST /pings/send/:targetId — internal helper also reused by /users/:targetId/ping
pingRoutes.post("/send/:targetId", requireAuth, requireLinked, async (c) => {
  const uid = c.get("uid");
  await sendPing(uid, c.req.param("targetId"));
  return c.json({ ok: true });
});

pingRoutes.get("/incoming", requireAuth, async (c) => {
  const uid = c.get("uid");
  const cutoff = decayCutoffISO();
  const snap = await db
    .collection("pings")
    .where("to_user_id", "==", uid)
    .where("rejected_at", "==", null)
    .where("created_at", ">=", cutoff)
    .orderBy("created_at", "desc")
    .get();

  // Build mutual lookup: pings I've sent, not rejected, in window
  const mineSnap = await db
    .collection("pings")
    .where("from_user_id", "==", uid)
    .where("rejected_at", "==", null)
    .where("created_at", ">=", cutoff)
    .get();
  const mutualTargets = new Set(
    mineSnap.docs.map((d) => (d.data() as PingDoc).to_user_id)
  );

  const fromIds = [...new Set(snap.docs.map((d) => (d.data() as PingDoc).from_user_id))];
  const userMap = new Map<string, UserDoc>();
  if (fromIds.length) {
    const snaps = await db.getAll(
      ...fromIds.map((id) => db.collection("users").doc(id))
    );
    snaps.forEach((s) => {
      if (s.exists) userMap.set(s.id, s.data() as UserDoc);
    });
  }

  const decay = decayDays();
  const now = Date.now();
  const incoming = snap.docs
    .map((d) => {
      const data = d.data() as PingDoc;
      const fromUser = userMap.get(data.from_user_id);
      if (!fromUser) return null;
      return {
        id: d.id,
        from: serializeUserSummary(data.from_user_id, fromUser),
        createdAt: data.created_at,
        intensity: pingIntensity(data.created_at, now, decay),
        mutual: mutualTargets.has(data.from_user_id),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return c.json({ incoming });
});

pingRoutes.get("/outgoing", requireAuth, async (c) => {
  const uid = c.get("uid");
  const cutoff = decayCutoffISO();
  const snap = await db
    .collection("pings")
    .where("from_user_id", "==", uid)
    .where("rejected_at", "==", null)
    .where("created_at", ">=", cutoff)
    .orderBy("created_at", "desc")
    .get();

  const inSnap = await db
    .collection("pings")
    .where("to_user_id", "==", uid)
    .where("rejected_at", "==", null)
    .where("created_at", ">=", cutoff)
    .get();
  const mutualFrom = new Set(inSnap.docs.map((d) => (d.data() as PingDoc).from_user_id));

  const toIds = [...new Set(snap.docs.map((d) => (d.data() as PingDoc).to_user_id))];
  const userMap = new Map<string, UserDoc>();
  if (toIds.length) {
    const snaps = await db.getAll(
      ...toIds.map((id) => db.collection("users").doc(id))
    );
    snaps.forEach((s) => {
      if (s.exists) userMap.set(s.id, s.data() as UserDoc);
    });
  }

  const decay = decayDays();
  const now = Date.now();
  const outgoing = snap.docs
    .map((d) => {
      const data = d.data() as PingDoc;
      const toUser = userMap.get(data.to_user_id);
      if (!toUser) return null;
      return {
        id: d.id,
        to: serializeUserSummary(data.to_user_id, toUser),
        createdAt: data.created_at,
        intensity: pingIntensity(data.created_at, now, decay),
        mutual: mutualFrom.has(data.to_user_id),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return c.json({ outgoing });
});

pingRoutes.post("/:pingId/ping-back", requireAuth, requireLinked, async (c) => {
  const pingId = c.req.param("pingId");
  const uid = c.get("uid");
  const snap = await db.collection("pings").doc(pingId).get();
  if (!snap.exists) throw notFound("Ping not found.");
  const data = snap.data() as PingDoc;
  if (data.to_user_id !== uid) throw forbidden("This ping is not addressed to you.");
  await sendPing(uid, data.from_user_id);
  return c.json({ ok: true });
});

pingRoutes.post("/:pingId/reject", requireAuth, requireLinked, async (c) => {
  const pingId = c.req.param("pingId");
  const uid = c.get("uid");
  const ref = db.collection("pings").doc(pingId);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("Ping not found.");
  const data = snap.data() as PingDoc;
  if (data.to_user_id !== uid) throw forbidden("This ping is not addressed to you.");
  await ref.update({ rejected_at: new Date().toISOString() });
  return c.json({ ok: true });
});

pingRoutes.post("/:pingId/revoke", requireAuth, requireLinked, async (c) => {
  const pingId = c.req.param("pingId");
  const uid = c.get("uid");
  const ref = db.collection("pings").doc(pingId);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("Ping not found.");
  const data = snap.data() as PingDoc;
  if (data.from_user_id !== uid) throw forbidden("This ping is not yours to revoke.");
  await ref.delete();
  return c.json({ ok: true });
});

pingRoutes.post("/dematch/:peerId", requireAuth, requireLinked, async (c) => {
  const peerId = c.req.param("peerId");
  const uid = c.get("uid");
  const a = db.collection("pings").doc(`${uid}_${peerId}`);
  const b = db.collection("pings").doc(`${peerId}_${uid}`);
  const batch = db.batch();
  batch.delete(a);
  batch.delete(b);
  await batch.commit();
  return c.json({ ok: true });
});

pingRoutes.get("/mutual-contacts", requireAuth, async (c) => {
  const uid = c.get("uid");
  const cutoff = decayCutoffISO();
  const out = await db
    .collection("pings")
    .where("from_user_id", "==", uid)
    .where("rejected_at", "==", null)
    .where("created_at", ">=", cutoff)
    .get();
  const inn = await db
    .collection("pings")
    .where("to_user_id", "==", uid)
    .where("rejected_at", "==", null)
    .where("created_at", ">=", cutoff)
    .get();
  const outByTarget = new Map(
    out.docs.map((d) => [(d.data() as PingDoc).to_user_id, { id: d.id, data: d.data() as PingDoc }])
  );
  const mutualIds: string[] = [];
  const infoMap = new Map<string, { pingId: string; matchedAt: string }>();
  for (const d of inn.docs) {
    const from = (d.data() as PingDoc).from_user_id;
    const outMatch = outByTarget.get(from);
    if (outMatch) {
      mutualIds.push(from);
      const createdA = (d.data() as PingDoc).created_at;
      const createdB = outMatch.data.created_at;
      const matchedAt = createdA > createdB ? createdA : createdB;
      infoMap.set(from, { pingId: outMatch.id, matchedAt });
    }
  }
  if (!mutualIds.length) return c.json({ contacts: [] });

  const userSnaps = await db.getAll(
    ...mutualIds.map((id) => db.collection("users").doc(id))
  );
  const contacts = userSnaps
    .filter((s) => s.exists)
    .map((s) => ({
      ...serializeUserSummary(s.id, s.data() as UserDoc),
      ...infoMap.get(s.id)!,
    }))
    .sort((a, b) => b.matchedAt.localeCompare(a.matchedAt));
  return c.json({ contacts });
});

// Export for userRoutes reuse of POST /users/:targetId/ping
export { sendPing };
