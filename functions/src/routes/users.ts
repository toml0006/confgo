import { Hono } from "hono";
import { z } from "zod";
import { attendances, conferences, users } from "../lib/firestore";
import { loadPingState } from "../lib/pings";
import { AppEnv, getUserId, requireAuth } from "../auth";

export const userRoutes = new Hono<AppEnv>();

function toPublicUser(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    avatarId: data.avatar_id ?? 0,
    displayName: data.display_name ?? null,
    photoURL: data.photo_url ?? null,
  };
}

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
    url: data.url ?? null,
  };
}

function hasVisibleDisplayName(data: FirebaseFirestore.DocumentData): boolean {
  return typeof data.display_name === "string" && data.display_name.length > 0;
}

const listQuery = z.object({
  q: z.string().trim().min(1).optional(),
});

userRoutes.get("/users", requireAuth, async (c) => {
  const parsed = listQuery.safeParse({ q: c.req.query("q") });
  if (!parsed.success) {
    return c.json({ error: "bad_request" }, 400);
  }
  const { q } = parsed.data;
  if (!q) {
    return c.json({ users: [] });
  }

  // in-memory text search, mirrors /conferences search pattern (PDD §13.3)
  const snap = await users().limit(2000).get();
  const needle = q.toLowerCase();
  const list = snap.docs
    .filter((d) => {
      const name = d.data().display_name;
      return typeof name === "string" && name.length > 0 && name.toLowerCase().includes(needle);
    })
    .slice(0, 500)
    .map((d) => toPublicUser(d.id, d.data()));
  return c.json({ users: list });
});

userRoutes.get("/users/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const snap = await users().doc(id).get();
  if (!snap.exists) return c.json({ error: "not_found" }, 404);
  const data = snap.data()!;
  // only surface users that have a display name — matches search visibility
  if (!hasVisibleDisplayName(data)) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.json(toPublicUser(id, data));
});

userRoutes.get("/users/:id/attendances", requireAuth, async (c) => {
  const id = c.req.param("id");
  // same visibility gate as /users and /users/:id — hidden users' attendance
  // shouldn't be reachable by UID guessing.
  const userSnap = await users().doc(id).get();
  if (!userSnap.exists) return c.json({ error: "not_found" }, 404);
  const data = userSnap.data()!;
  if (!hasVisibleDisplayName(data)) {
    return c.json({ error: "not_found" }, 404);
  }

  const snap = await attendances().where("user_id", "==", id).get();
  const out = snap.docs.map((d) => ({
    conferenceId: d.get("conference_id") as string,
    intent: d.get("intent") as "been" | "going",
  }));
  return c.json({ attendances: out });
});

// GET /users/:id/profile — peer view that combines public user info, the
// list of shared conferences, and the viewer's ping state vs the peer.
// Returns pingState: null for self-lookup.
userRoutes.get("/users/:id/profile", requireAuth, async (c) => {
  const peerId = c.req.param("id");
  const me = getUserId(c);

  const snap = await users().doc(peerId).get();
  if (!snap.exists) return c.json({ error: "not_found" }, 404);
  const data = snap.data()!;
  if (!hasVisibleDisplayName(data)) {
    return c.json({ error: "not_found" }, 404);
  }
  const user = toPublicUser(peerId, data);

  if (me === peerId) {
    return c.json({ user, shared: [], pingState: null });
  }

  const [mySnap, peerSnap] = await Promise.all([
    attendances().where("user_id", "==", me).get(),
    attendances().where("user_id", "==", peerId).get(),
  ]);
  const myConfs = new Set(mySnap.docs.map((d) => d.get("conference_id") as string));
  const sharedIds = peerSnap.docs
    .map((d) => d.get("conference_id") as string)
    .filter((id) => myConfs.has(id));

  let shared: ReturnType<typeof toApiConference>[] = [];
  if (sharedIds.length > 0) {
    const refs = sharedIds.map((id) => conferences().doc(id));
    const docs = await conferences().firestore.getAll(...refs);
    shared = docs
      .filter((d) => d.exists)
      .map((d) => toApiConference(d.id, d.data()!))
      .sort((a, b) => (a.startDate > b.startDate ? -1 : 1));
  }

  const state = await loadPingState(me);
  const pingState = {
    youPinged: state.activeOutgoing.some((p) => p.toUserId === peerId),
    hasPingedYou: state.activeIncoming.some((p) => p.fromUserId === peerId),
  };

  return c.json({ user, shared, pingState });
});
