import { Hono } from "hono";
import { z } from "zod";
import { users, attendances } from "../lib/firestore";
import { AppEnv, getUserId, requireAuth } from "../auth";

export const me = new Hono<AppEnv>();

function toApiUser(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    avatarId: data.avatar_id ?? 0,
    email: data.email ?? null,
    displayName: data.display_name ?? null,
    photoURL: data.photo_url ?? null,
  };
}

me.get("/me", requireAuth, async (c) => {
  const userId = getUserId(c);
  const snap = await users().doc(userId).get();
  if (!snap.exists) return c.json({ error: "not_found" }, 404);
  return c.json(toApiUser(userId, snap.data()!));
});

const patchSchema = z.object({
  avatarId: z.number().int().min(0).max(47).optional(),
  displayName: z.string().max(50).nullable().optional(),
  photoURL: z.string().url().nullable().optional(),
});

me.patch("/me", requireAuth, async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "bad_request", details: parsed.error.flatten() }, 400);
  }
  const patch: Record<string, unknown> = {};
  if (parsed.data.avatarId !== undefined) patch.avatar_id = parsed.data.avatarId;
  if (parsed.data.displayName !== undefined) patch.display_name = parsed.data.displayName;
  if (parsed.data.photoURL !== undefined) patch.photo_url = parsed.data.photoURL;

  if (Object.keys(patch).length > 0) {
    await users().doc(userId).update(patch);
  }
  const snap = await users().doc(userId).get();
  return c.json(toApiUser(userId, snap.data()!));
});

me.get("/me/attendances", requireAuth, async (c) => {
  const userId = getUserId(c);
  const snap = await attendances().where("user_id", "==", userId).get();
  const out = snap.docs.map((d) => ({
    conferenceId: d.get("conference_id"),
    intent: d.get("intent"),
  }));
  return c.json({ attendances: out });
});
