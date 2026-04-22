import { Hono } from "hono";
import { z } from "zod";
import { users, attendances } from "../lib/firestore";
import { AppEnv, requireAuth } from "../auth";

export const userRoutes = new Hono<AppEnv>();

function toPublicUser(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    avatarId: data.avatar_id ?? 0,
    displayName: data.display_name ?? null,
    photoURL: data.photo_url ?? null,
  };
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
  if (typeof data.display_name !== "string" || data.display_name.length === 0) {
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
  if (typeof data.display_name !== "string" || data.display_name.length === 0) {
    return c.json({ error: "not_found" }, 404);
  }

  const snap = await attendances().where("user_id", "==", id).get();
  const out = snap.docs.map((d) => ({
    conferenceId: d.get("conference_id") as string,
    intent: d.get("intent") as "been" | "going",
  }));
  return c.json({ attendances: out });
});
