import { Hono } from "hono";
import { z } from "zod";
import {
  attendances,
  attendanceId,
  conferences,
  getUsersByIds,
  nowIso,
} from "../lib/firestore";
import { loadPingState } from "../lib/pings";
import { AppEnv, getUserId, maybeUserId, optionalAuth, requireAuth } from "../auth";

export const conferenceRoutes = new Hono<AppEnv>();

type ConferenceData = {
  name: string;
  location_name: string;
  latitude: number;
  longitude: number;
  start_date: string;
  end_date: string;
  source?: string;
  topics?: string[];
  url?: string | null;
  created_at: string;
  premium?: boolean;
  premium_image_url?: string | null;
  premium_header?: string | null;
  premium_subtitle?: string | null;
  premium_body?: string | null;
};

function toApiConference(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    name: data.name,
    locationName: data.location_name,
    latitude: data.latitude,
    longitude: data.longitude,
    startDate: data.start_date,
    endDate: data.end_date,
    source: data.source ?? null,
    topics: data.topics ?? [],
    tags: data.tags ?? [],
    categories: data.categories ?? [],
    subgroups: data.subgroups ?? [],
    url: data.url ?? null,
    premium: data.premium === true,
    premiumImage: data.premium_image_url ?? null,
    premiumHeader: data.premium_header ?? null,
    premiumSubtitle: data.premium_subtitle ?? null,
    premiumBody: data.premium_body ?? null,
  };
}

const listQuery = z.object({
  q: z.string().trim().min(1).optional(),
  bbox: z.string().optional(),
  // comma-separated tag slugs — AND filter (all must match)
  tags: z.string().trim().min(1).optional(),
  // comma-separated tag slugs — OR filter (any match). Used by the Venn-egg
  // overlay which needs the union of conferences across the selected tags.
  // Capped at 30 values (Firestore array-contains-any limit).
  tagsAny: z.string().trim().min(1).optional(),
});

conferenceRoutes.get("/conferences", async (c) => {
  const parsed = listQuery.safeParse({
    q: c.req.query("q"),
    bbox: c.req.query("bbox"),
    tags: c.req.query("tags"),
    tagsAny: c.req.query("tagsAny"),
  });
  if (!parsed.success) {
    return c.json({ error: "bad_request" }, 400);
  }
  const { q, bbox, tags: tagsParam, tagsAny: tagsAnyParam } = parsed.data;
  const requiredTags = tagsParam
    ? tagsParam.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
    : [];
  const anyTags = tagsAnyParam
    ? tagsAnyParam.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 30)
    : [];

  if (anyTags.length > 0) {
    const snap = await conferences()
      .where("tags", "array-contains-any", anyTags)
      .orderBy("start_date", "desc")
      .limit(2000)
      .get();
    const list = snap.docs
      .slice(0, 1000)
      .map((d) => toApiConference(d.id, d.data()));
    return c.json({ conferences: list });
  }

  if (requiredTags.length > 0) {
    // Use first tag as the indexed predicate (Firestore allows one
    // array-contains per query); filter the remaining tags in memory.
    const [firstTag, ...rest] = requiredTags;
    const snap = await conferences()
      .where("tags", "array-contains", firstTag)
      .orderBy("start_date", "desc")
      .limit(2000)
      .get();
    const needle = q?.toLowerCase();
    const list = snap.docs
      .filter((d) => {
        const data = d.data();
        const docTags: string[] = data.tags ?? [];
        if (!rest.every((t) => docTags.includes(t))) return false;
        if (needle) {
          return (
            (data.name ?? "").toLowerCase().includes(needle) ||
            (data.location_name ?? "").toLowerCase().includes(needle)
          );
        }
        return true;
      })
      .slice(0, 500)
      .map((d) => toApiConference(d.id, d.data()));
    return c.json({ conferences: list });
  }

  if (q) {
    // in-memory text search, per PDD §13.3
    const snap = await conferences().orderBy("start_date", "desc").limit(2000).get();
    const needle = q.toLowerCase();
    const list = snap.docs
      .filter((d) => {
        const data = d.data();
        return (
          (data.name ?? "").toLowerCase().includes(needle) ||
          (data.location_name ?? "").toLowerCase().includes(needle)
        );
      })
      .slice(0, 500)
      .map((d) => toApiConference(d.id, d.data()));
    return c.json({ conferences: list });
  }

  if (bbox) {
    const parts = bbox.split(",").map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
      return c.json({ error: "bad_bbox" }, 400);
    }
    const [minLng, minLat, maxLng, maxLat] = parts;
    // No geohash index — fetch newest 2000 and filter in memory.
    const snap = await conferences().orderBy("start_date", "desc").limit(2000).get();
    const list = snap.docs
      .filter((d) => {
        const { latitude, longitude } = d.data();
        return (
          longitude >= minLng &&
          longitude <= maxLng &&
          latitude >= minLat &&
          latitude <= maxLat
        );
      })
      .map((d) => toApiConference(d.id, d.data()));
    return c.json({ conferences: list });
  }

  const snap = await conferences().orderBy("start_date", "desc").limit(2000).get();
  return c.json({
    conferences: snap.docs.map((d) => toApiConference(d.id, d.data())),
  });
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  locationName: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
  topics: z.array(z.string()).optional(),
  url: z.string().url().optional().nullable(),
});

conferenceRoutes.post("/conferences", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "bad_request", details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;
  const doc: ConferenceData = {
    name: input.name,
    location_name: input.locationName,
    latitude: input.latitude,
    longitude: input.longitude,
    start_date: input.startDate,
    end_date: input.endDate,
    topics: input.topics ?? [],
    url: input.url ?? null,
    created_at: nowIso(),
  };
  const ref = await conferences().add(doc);
  const snap = await ref.get();
  return c.json(toApiConference(ref.id, snap.data()!), 201);
});

conferenceRoutes.get("/conferences/:id", async (c) => {
  const id = c.req.param("id");
  const snap = await conferences().doc(id).get();
  if (!snap.exists) return c.json({ error: "not_found" }, 404);
  return c.json(toApiConference(id, snap.data()!));
});

conferenceRoutes.get("/conferences/:id/attendees", optionalAuth, async (c) => {
  const id = c.req.param("id");
  const viewer = maybeUserId(c);
  const confSnap = await conferences().doc(id).get();
  if (!confSnap.exists) return c.json({ error: "not_found" }, 404);

  const attendanceSnap = await attendances().where("conference_id", "==", id).get();
  const userIds = Array.from(new Set(attendanceSnap.docs.map((d) => d.get("user_id") as string)));
  const usersById = await getUsersByIds(userIds);

  // Build viewer's active ping state once so we can stamp each attendee row.
  // Includes mutual peers in both sets — UI uses both flags to render the
  // "matched" indicator.
  let pingedByMe = new Set<string>();
  let pingedMe = new Set<string>();
  if (viewer) {
    const state = await loadPingState(viewer);
    pingedByMe = new Set(state.activeOutgoing.map((p) => p.toUserId));
    pingedMe = new Set(state.activeIncoming.map((p) => p.fromUserId));
  }

  const out = attendanceSnap.docs.map((d) => {
    const uid = d.get("user_id") as string;
    const u = usersById.get(uid);
    return {
      userId: uid,
      intent: d.get("intent"),
      avatarId: u?.avatar_id ?? 0,
      displayName: u?.display_name ?? null,
      photoURL: u?.photo_url ?? null,
      isYou: viewer === uid,
      youPinged: pingedByMe.has(uid),
      hasPingedYou: pingedMe.has(uid),
    };
  });
  return c.json({ attendees: out });
});

const attendSchema = z.object({
  intent: z.enum(["been", "going"]),
});

conferenceRoutes.post("/conferences/:id/attend", requireAuth, async (c) => {
  const confId = c.req.param("id");
  const userId = getUserId(c);
  const body = await c.req.json().catch(() => null);
  const parsed = attendSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "bad_request" }, 400);
  }
  const confSnap = await conferences().doc(confId).get();
  if (!confSnap.exists) return c.json({ error: "not_found" }, 404);
  const id = attendanceId(userId, confId);
  await attendances().doc(id).set({
    user_id: userId,
    conference_id: confId,
    intent: parsed.data.intent,
    created_at: nowIso(),
  });
  return c.json({ ok: true });
});

conferenceRoutes.delete("/conferences/:id/attend", requireAuth, async (c) => {
  const confId = c.req.param("id");
  const userId = getUserId(c);
  const id = attendanceId(userId, confId);
  await attendances().doc(id).delete();
  return c.json({ ok: true });
});
