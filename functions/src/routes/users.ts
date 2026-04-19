import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { optionalAuth, requireAuth, requireLinked } from "../middleware/auth";
import { db } from "../lib/firestore";
import { serializeConference, serializeUserSummary } from "../lib/serialize";
import type { AttendanceDoc, ConferenceDoc, HonoVars, UserDoc } from "../lib/types";
import { conferencesForUser } from "./me";
import { notFound } from "../lib/errors";
import { sendPing } from "./pings";

export const userRoutes = new Hono<HonoVars>();

userRoutes.use("*", optionalAuth);

userRoutes.get(
  "/search",
  requireAuth,
  zValidator("query", z.object({ q: z.string().trim().min(1).max(100) })),
  async (c) => {
    const { q } = c.req.valid("query");
    const needle = q.toLowerCase();
    const snap = await db.collection("users").limit(2000).get();
    const hits = snap.docs
      .map((d) => ({ id: d.id, data: d.data() as UserDoc }))
      .filter(({ data }) => (data.display_name ?? "").toLowerCase().includes(needle))
      .slice(0, 20)
      .map(({ id, data }) => serializeUserSummary(id, data));
    return c.json({ users: hits });
  }
);

userRoutes.post(
  "/shared-conferences",
  requireAuth,
  zValidator("json", z.object({ userIds: z.array(z.string().min(1)).min(1).max(20) })),
  async (c) => {
    const viewer = c.get("uid");
    const { userIds } = c.req.valid("json");
    const allIds = [...new Set([viewer, ...userIds])];
    const attendancesByUser = await Promise.all(
      allIds.map((uid) =>
        db
          .collection("attendances")
          .where("user_id", "==", uid)
          .get()
          .then((snap) =>
            new Set(snap.docs.map((d) => (d.data() as AttendanceDoc).conference_id))
          )
      )
    );
    let shared = [...attendancesByUser[0]];
    for (let i = 1; i < attendancesByUser.length; i++) {
      const set = attendancesByUser[i];
      shared = shared.filter((cid) => set.has(cid));
    }
    if (!shared.length) return c.json({ conferences: [] });
    const confs: ReturnType<typeof serializeConference>[] = [];
    for (let i = 0; i < shared.length; i += 30) {
      const chunk = shared.slice(i, i + 30);
      const snaps = await db.getAll(
        ...chunk.map((id) => db.collection("conferences").doc(id))
      );
      for (const s of snaps) {
        if (s.exists) confs.push(serializeConference(s.id, s.data() as ConferenceDoc));
      }
    }
    return c.json({
      conferences: confs.sort((a, b) => b.startDate.localeCompare(a.startDate)),
    });
  }
);

userRoutes.post("/:targetId/ping", requireAuth, requireLinked, async (c) => {
  const uid = c.get("uid");
  await sendPing(uid, c.req.param("targetId"));
  return c.json({ ok: true });
});

userRoutes.get("/:userId/profile", requireAuth, async (c) => {
  const userId = c.req.param("userId");
  const viewer = c.get("uid");
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) throw notFound("User not found.");
  const u = snap.data() as UserDoc;
  const peerConferences = await conferencesForUser(userId);
  const mine = new Set(
    (
      await db.collection("attendances").where("user_id", "==", viewer).get()
    ).docs.map((d) => (d.data() as AttendanceDoc).conference_id)
  );
  const shared = peerConferences.filter((c) => mine.has(c.id));
  return c.json({
    user: serializeUserSummary(userId, u),
    conferences: peerConferences,
    shared,
  });
});

userRoutes.get("/:peerId/shared-map", requireAuth, async (c) => {
  const peerId = c.req.param("peerId");
  const viewer = c.get("uid");
  const mine = await db.collection("attendances").where("user_id", "==", viewer).get();
  const theirs = await db.collection("attendances").where("user_id", "==", peerId).get();
  const mineSet = new Set(mine.docs.map((d) => (d.data() as AttendanceDoc).conference_id));
  const sharedIds = theirs.docs
    .map((d) => (d.data() as AttendanceDoc).conference_id)
    .filter((id) => mineSet.has(id));
  if (!sharedIds.length) return c.json({ conferences: [] });
  const confs: ReturnType<typeof serializeConference>[] = [];
  for (let i = 0; i < sharedIds.length; i += 30) {
    const chunk = sharedIds.slice(i, i + 30);
    const snaps = await db.getAll(
      ...chunk.map((id) => db.collection("conferences").doc(id))
    );
    for (const s of snaps) {
      if (s.exists) confs.push(serializeConference(s.id, s.data() as ConferenceDoc));
    }
  }
  return c.json({
    conferences: confs.sort((a, b) => a.startDate.localeCompare(b.startDate)),
  });
});
