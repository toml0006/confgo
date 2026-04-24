import { Hono } from "hono";
import { z } from "zod";
import { attendances, conferences, users } from "../lib/firestore";
import { loadPingState, userPublic } from "../lib/pings";
import { AppEnv, maybeUserId, optionalAuth } from "../auth";

export const userRoutes = new Hono<AppEnv>();

const searchQuery = z.object({ q: z.string().trim().min(2).max(50) });

// In-memory text search per PDD §13.3 — Firestore lacks substring indexes and
// the user count is small. Excludes self.
userRoutes.get("/users/search", optionalAuth, async (c) => {
  const parsed = searchQuery.safeParse({ q: c.req.query("q") });
  if (!parsed.success) return c.json({ error: "bad_request" }, 400);
  const needle = parsed.data.q.toLowerCase();
  const me = maybeUserId(c);

  const snap = await users().limit(2000).get();
  const out = snap.docs
    .filter((d) => {
      if (d.id === me) return false;
      const name = (d.get("display_name") as string | null) ?? "";
      return name.toLowerCase().includes(needle);
    })
    .slice(0, 20)
    .map((d) => userPublic(d.id, d.data()));
  return c.json({ users: out });
});

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

// GET /users/:userId/profile — public-ish view of another user.
// Returns: user (UserSummary), shared (conferences both parties attend;
// empty when viewer unauthenticated), pingState (viewer's ping state vs
// peer; null when unauthenticated).
userRoutes.get("/users/:userId/profile", optionalAuth, async (c) => {
  const peerId = c.req.param("userId");
  const me = maybeUserId(c);

  const snap = await users().doc(peerId).get();
  if (!snap.exists) return c.json({ error: "not_found" }, 404);

  const user = userPublic(peerId, snap.data());
  if (!me || me === peerId) {
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
