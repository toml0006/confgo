import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { db } from "../lib/firestore";
import {
  serializeConference,
  serializeUser,
  serializeUserSummary,
} from "../lib/serialize";
import type { AttendanceDoc, ConferenceDoc, HonoVars, PingDoc, UserDoc } from "../lib/types";
import { decayCutoffISO } from "../lib/serialize";

export const meRoutes = new Hono<HonoVars>();

meRoutes.use("*", optionalAuth, requireAuth);

meRoutes.get("/", (c) => {
  const user = c.get("user");
  return c.json(serializeUser(user.id, user));
});

meRoutes.patch(
  "/",
  zValidator(
    "json",
    z
      .object({
        avatarId: z.number().int().min(0).max(47).optional(),
        displayName: z.string().max(50).nullable().optional(),
        photoURL: z.string().url().nullable().optional(),
      })
      .refine((v) => Object.keys(v).length > 0, { message: "At least one field required." })
  ),
  async (c) => {
    const uid = c.get("uid");
    const body = c.req.valid("json");
    const update: Partial<UserDoc> = {};
    if (body.avatarId !== undefined) update.avatar_id = body.avatarId;
    if (body.displayName !== undefined) update.display_name = body.displayName ?? null;
    if (body.photoURL !== undefined) update.photo_url = body.photoURL ?? null;
    await db.collection("users").doc(uid).update(update);
    const snap = await db.collection("users").doc(uid).get();
    return c.json(serializeUser(uid, snap.data() as UserDoc));
  }
);

meRoutes.get("/attendances", async (c) => {
  const uid = c.get("uid");
  const snap = await db
    .collection("attendances")
    .where("user_id", "==", uid)
    .get();
  const attendances = snap.docs.map((d) => {
    const data = d.data() as AttendanceDoc;
    return {
      conferenceId: data.conference_id,
      intent: data.intent,
      createdAt: data.created_at,
    };
  });
  return c.json({ attendances });
});

meRoutes.get("/co-attendance", async (c) => {
  const uid = c.get("uid");
  const mine = await db
    .collection("attendances")
    .where("user_id", "==", uid)
    .get();
  const myConfIds = mine.docs.map((d) => (d.data() as AttendanceDoc).conference_id);
  if (!myConfIds.length) return c.json({ peers: [] });

  const peerMap = new Map<string, { confIds: Set<string> }>();
  for (let i = 0; i < myConfIds.length; i += 30) {
    const chunk = myConfIds.slice(i, i + 30);
    const batch = await db
      .collection("attendances")
      .where("conference_id", "in", chunk)
      .get();
    for (const doc of batch.docs) {
      const a = doc.data() as AttendanceDoc;
      if (a.user_id === uid) continue;
      let entry = peerMap.get(a.user_id);
      if (!entry) {
        entry = { confIds: new Set() };
        peerMap.set(a.user_id, entry);
      }
      entry.confIds.add(a.conference_id);
    }
  }
  const peerIds = [...peerMap.keys()];
  if (!peerIds.length) return c.json({ peers: [] });

  const userRefs = peerIds.map((id) => db.collection("users").doc(id));
  const userSnaps: FirebaseFirestore.DocumentSnapshot[] = [];
  for (let i = 0; i < userRefs.length; i += 100) {
    const slice = userRefs.slice(i, i + 100);
    const snaps = await db.getAll(...slice);
    userSnaps.push(...snaps);
  }

  const cutoff = decayCutoffISO();
  const outPings = await db
    .collection("pings")
    .where("from_user_id", "==", uid)
    .where("rejected_at", "==", null)
    .where("created_at", ">=", cutoff)
    .get();
  const inPings = await db
    .collection("pings")
    .where("to_user_id", "==", uid)
    .where("rejected_at", "==", null)
    .where("created_at", ">=", cutoff)
    .get();
  const youPinged = new Set(outPings.docs.map((d) => (d.data() as PingDoc).to_user_id));
  const pingedYou = new Set(inPings.docs.map((d) => (d.data() as PingDoc).from_user_id));

  const peers = userSnaps
    .filter((s) => s.exists)
    .map((snap) => {
      const entry = peerMap.get(snap.id)!;
      const data = snap.data() as UserDoc;
      return {
        ...serializeUserSummary(snap.id, data),
        sharedCount: entry.confIds.size,
        sharedConferenceIds: [...entry.confIds],
        youPinged: youPinged.has(snap.id),
        hasPingedYou: pingedYou.has(snap.id),
        mutual: youPinged.has(snap.id) && pingedYou.has(snap.id),
      };
    })
    .sort((a, b) => b.sharedCount - a.sharedCount);

  return c.json({ peers });
});

// Helper exported for other routes: conferences for a user id
export async function conferencesForUser(userId: string): Promise<ReturnType<typeof serializeConference>[]> {
  const attendances = await db.collection("attendances").where("user_id", "==", userId).get();
  const ids = attendances.docs.map((d) => (d.data() as AttendanceDoc).conference_id);
  if (!ids.length) return [];
  const results: ReturnType<typeof serializeConference>[] = [];
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const snaps = await db.getAll(
      ...chunk.map((id) => db.collection("conferences").doc(id))
    );
    for (const s of snaps) {
      if (s.exists) results.push(serializeConference(s.id, s.data() as ConferenceDoc));
    }
  }
  return results;
}
