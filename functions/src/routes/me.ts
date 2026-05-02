import { Hono } from "hono";
import { z } from "zod";
import { users, attendances, chunk, getUsersByIds } from "../lib/firestore";
import { savedContactsArraySchema } from "../lib/contacts";
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
  // Anonymous users can change avatarId / displayName but not photoURL.
  // Photos are tied to a linked identity; falling back to the glyph for
  // anon keeps the surface area of orphaned uploads small.
  if (parsed.data.photoURL !== undefined && c.get("signInProvider") === "anonymous") {
    return c.json({ error: "linked_account_required" }, 403);
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

// Top peers by count of conferences both me and them have attended.
// Used by the personal overlap Venn — caller passes ?limit=N to size the diagram.
const overlapQuery = z.object({
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

me.get("/me/overlap-peers", requireAuth, async (c) => {
  const userId = getUserId(c);
  const parsed = overlapQuery.safeParse({ limit: c.req.query("limit") });
  if (!parsed.success) return c.json({ error: "bad_request" }, 400);
  const limit = parsed.data.limit ?? 2;

  const mineSnap = await attendances().where("user_id", "==", userId).get();
  const myConfIds = Array.from(
    new Set(mineSnap.docs.map((d) => d.get("conference_id") as string)),
  );
  if (myConfIds.length === 0) return c.json({ peers: [] });

  // Tally other users who attended any of my conferences. Firestore "in"
  // caps at 30 values per query, so chunk.
  const counts = new Map<string, number>();
  for (const ids of chunk(myConfIds, 30)) {
    const snap = await attendances().where("conference_id", "in", ids).get();
    for (const d of snap.docs) {
      const other = d.get("user_id") as string;
      if (other === userId) continue;
      counts.set(other, (counts.get(other) ?? 0) + 1);
    }
  }

  // Sort by overlap desc, then fetch user docs and drop hidden (no display_name) users.
  const ranked = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(limit * 4, limit + 5)); // overfetch since some may be hidden

  const usersById = await getUsersByIds(ranked.map(([id]) => id));
  const peers: Array<{
    user: {
      id: string;
      avatarId: number;
      displayName: string | null;
      photoURL: string | null;
    };
    sharedCount: number;
  }> = [];
  for (const [id, sharedCount] of ranked) {
    const data = usersById.get(id);
    if (!data) continue;
    if (typeof data.display_name !== "string" || data.display_name.length === 0) continue;
    peers.push({
      user: {
        id,
        avatarId: data.avatar_id ?? 0,
        displayName: data.display_name,
        photoURL: data.photo_url ?? null,
      },
      sharedCount,
    });
    if (peers.length >= limit) break;
  }
  return c.json({ peers });
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

// Contact cards the user picks from when sending a ping. Stored on the user
// doc; never disclosed to anyone except via explicit selection on a ping.
// Anon-allowed: anon users can prepare cards even if they can't ping yet.
me.get("/me/contacts", requireAuth, async (c) => {
  const userId = getUserId(c);
  const snap = await users().doc(userId).get();
  const saved = (snap.get("saved_contacts") as unknown[] | undefined) ?? [];
  return c.json({ contacts: saved });
});

const putContactsSchema = z.object({ contacts: savedContactsArraySchema });

me.put("/me/contacts", requireAuth, async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json().catch(() => null);
  const parsed = putContactsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "bad_request", details: parsed.error.flatten() }, 400);
  }
  await users().doc(userId).update({ saved_contacts: parsed.data.contacts });
  return c.json({ contacts: parsed.data.contacts });
});
