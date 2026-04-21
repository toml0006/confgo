import { Hono } from "hono";
import { z } from "zod";
import { auth, users, nowIso } from "../lib/firestore";
import { AppEnv } from "../auth";

export const authRoutes = new Hono<AppEnv>();

const devSessionSchema = z.object({
  userId: z.string().min(1),
});

authRoutes.post("/auth/dev-session", async (c) => {
  if (!process.env.FUNCTIONS_EMULATOR) {
    return c.json({ error: "forbidden" }, 403);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = devSessionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "bad_request", details: parsed.error.flatten() }, 400);
  }
  const { userId } = parsed.data;

  let authUser;
  try {
    authUser = await auth.getUser(userId);
  } catch {
    authUser = await auth.createUser({ uid: userId });
  }

  const userRef = users().doc(userId);
  const snap = await userRef.get();
  if (!snap.exists) {
    await userRef.set({
      avatar_id: Math.floor(Math.random() * 48),
      email: authUser.email ?? null,
      display_name: null,
      photo_url: null,
      created_at: nowIso(),
    });
  }

  const customToken = await auth.createCustomToken(userId);
  const finalSnap = await userRef.get();
  return c.json({
    customToken,
    user: { id: userId, ...finalSnap.data() },
  });
});
