import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createHash } from "node:crypto";
import { optionalAuth, requireAdmin, requireAuth } from "../middleware/auth";
import { db } from "../lib/firestore";
import {
  decayCutoffISO,
  serializeConference,
  serializeUserSummary,
} from "../lib/serialize";
import { conflict, notFound } from "../lib/errors";
import type {
  AttendanceDoc,
  ConferenceDoc,
  HonoVars,
  PingDoc,
  UserDoc,
} from "../lib/types";

export const conferenceRoutes = new Hono<HonoVars>();

conferenceRoutes.use("*", optionalAuth);

const iso = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "must be ISO 8601 datetime" });

const newConferenceSchema = z
  .object({
    name: z.string().min(1).max(200),
    locationName: z.string().min(1).max(200),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    startDate: iso,
    endDate: iso,
    topics: z.array(z.string()).optional(),
    url: z.string().url().nullable().optional(),
  })
  .refine((v) => Date.parse(v.endDate) >= Date.parse(v.startDate), {
    path: ["endDate"],
    message: "endDate must be on or after startDate",
  });

const listQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .optional(),
});

conferenceRoutes.get("/", zValidator("query", listQuerySchema), async (c) => {
  const { q, bbox } = c.req.valid("query");

  if (q) {
    const all = await db
      .collection("conferences")
      .orderBy("start_date", "desc")
      .limit(2000)
      .get();
    const needle = q.toLowerCase();
    const filtered = all.docs
      .map((d) => ({ id: d.id, data: d.data() as ConferenceDoc }))
      .filter(
        ({ data }) =>
          data.name.toLowerCase().includes(needle) ||
          data.location_name.toLowerCase().includes(needle)
      )
      .slice(0, 500)
      .map(({ id, data }) => serializeConference(id, data));
    return c.json({ conferences: filtered });
  }

  let query: FirebaseFirestore.Query = db
    .collection("conferences")
    .orderBy("start_date", "desc")
    .limit(2000);

  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox.split(",").map(Number);
    // Firestore can't do range on both lat+lng in one query; filter in memory.
    const snap = await query.get();
    const filtered = snap.docs
      .map((d) => ({ id: d.id, data: d.data() as ConferenceDoc }))
      .filter(
        ({ data }) =>
          data.latitude >= minLat &&
          data.latitude <= maxLat &&
          data.longitude >= minLng &&
          data.longitude <= maxLng
      )
      .map(({ id, data }) => serializeConference(id, data));
    return c.json({ conferences: filtered });
  }

  const snap = await query.get();
  return c.json({
    conferences: snap.docs.map((d) =>
      serializeConference(d.id, d.data() as ConferenceDoc)
    ),
  });
});

conferenceRoutes.post(
  "/",
  requireAdmin,
  zValidator("json", newConferenceSchema),
  async (c) => {
    const body = c.req.valid("json");
    const hash = createHash("sha256")
      .update(`${body.name.toLowerCase()}|${body.startDate}`)
      .digest("hex")
      .slice(0, 16);
    const id = `uc_${hash}`;
    const doc: ConferenceDoc = {
      name: body.name,
      location_name: body.locationName,
      latitude: body.latitude,
      longitude: body.longitude,
      start_date: body.startDate,
      end_date: body.endDate,
      topics: body.topics ?? [],
      url: body.url ?? null,
      created_at: new Date().toISOString(),
    };
    await db.collection("conferences").doc(id).set(doc);
    c.status(201);
    return c.json(serializeConference(id, doc));
  }
);

conferenceRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const snap = await db.collection("conferences").doc(id).get();
  if (!snap.exists) throw notFound("Conference not found.");
  return c.json(serializeConference(snap.id, snap.data() as ConferenceDoc));
});

conferenceRoutes.get("/:id/attendees", async (c) => {
  const id = c.req.param("id");
  const attendances = await db
    .collection("attendances")
    .where("conference_id", "==", id)
    .get();
  if (attendances.empty) return c.json({ attendees: [] });
  const userIds = [...new Set(attendances.docs.map((d) => (d.data() as AttendanceDoc).user_id))];
  const refs = userIds.map((u) => db.collection("users").doc(u));
  const snaps = await db.getAll(...refs);
  const userMap = new Map<string, UserDoc>();
  snaps.forEach((s) => {
    if (s.exists) userMap.set(s.id, s.data() as UserDoc);
  });

  const viewer = c.get("uid");
  const youPinged = new Set<string>();
  const pingedYou = new Set<string>();
  if (viewer) {
    const cutoff = decayCutoffISO();
    const out = await db
      .collection("pings")
      .where("from_user_id", "==", viewer)
      .where("rejected_at", "==", null)
      .where("created_at", ">=", cutoff)
      .get();
    const inn = await db
      .collection("pings")
      .where("to_user_id", "==", viewer)
      .where("rejected_at", "==", null)
      .where("created_at", ">=", cutoff)
      .get();
    out.docs.forEach((d) => youPinged.add((d.data() as PingDoc).to_user_id));
    inn.docs.forEach((d) => pingedYou.add((d.data() as PingDoc).from_user_id));
  }

  const attendees = attendances.docs
    .map((d) => {
      const a = d.data() as AttendanceDoc;
      const u = userMap.get(a.user_id);
      if (!u) return null;
      const base = serializeUserSummary(a.user_id, u);
      return viewer
        ? {
            ...base,
            intent: a.intent,
            youPinged: youPinged.has(a.user_id),
            hasPingedYou: pingedYou.has(a.user_id),
          }
        : { ...base, intent: a.intent };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return c.json({ attendees });
});

conferenceRoutes.post(
  "/:id/attend",
  requireAuth,
  zValidator("json", z.object({ intent: z.enum(["been", "going"]) })),
  async (c) => {
    const id = c.req.param("id");
    const { intent } = c.req.valid("json");
    const uid = c.get("uid");
    const confSnap = await db.collection("conferences").doc(id).get();
    if (!confSnap.exists) throw notFound("Conference not found.");
    const attendanceId = `${uid}_${id}`;
    const doc: AttendanceDoc = {
      user_id: uid,
      conference_id: id,
      intent,
      created_at: new Date().toISOString(),
    };
    await db.collection("attendances").doc(attendanceId).set(doc);
    return c.json({ ok: true });
  }
);

conferenceRoutes.delete("/:id/attend", requireAuth, async (c) => {
  const id = c.req.param("id");
  const uid = c.get("uid");
  const attendanceId = `${uid}_${id}`;
  const ref = db.collection("attendances").doc(attendanceId);
  const snap = await ref.get();
  if (!snap.exists) throw conflict("No attendance record to remove.");
  await ref.delete();
  return c.json({ ok: true });
});
