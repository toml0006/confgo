import { Context, MiddlewareHandler } from "hono";
import { auth, users, nowIso } from "./lib/firestore";

export type AppEnv = {
  Variables: {
    userId: string;
    email: string | null;
    signInProvider: string | null;
  };
};

const AVATAR_COUNT = 48;

async function ensureUserDoc(userId: string, email: string | null) {
  const ref = users().doc(userId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      avatar_id: Math.floor(Math.random() * AVATAR_COUNT),
      email: email ?? null,
      display_name: null,
      photo_url: null,
      created_at: nowIso(),
    });
    return;
  }
  const data = snap.data()!;
  if (email && data.email !== email) {
    await ref.update({ email });
  }
}

function signInProviderOf(decoded: { firebase?: { sign_in_provider?: string } }): string | null {
  return decoded.firebase?.sign_in_provider ?? null;
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("authorization") ?? c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "missing_token" }, 401);
  }
  const token = header.slice("Bearer ".length);
  try {
    const decoded = await auth.verifyIdToken(token);
    c.set("userId", decoded.uid);
    c.set("email", (decoded.email as string | undefined) ?? null);
    c.set("signInProvider", signInProviderOf(decoded));
    await ensureUserDoc(decoded.uid, (decoded.email as string | undefined) ?? null);
    await next();
    return;
  } catch (_err) {
    return c.json({ error: "invalid_token" }, 401);
  }
};

export const optionalAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("authorization") ?? c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length);
    try {
      const decoded = await auth.verifyIdToken(token);
      c.set("userId", decoded.uid);
      c.set("email", (decoded.email as string | undefined) ?? null);
      c.set("signInProvider", signInProviderOf(decoded));
    } catch (_err) {
      // fall through as anonymous
    }
  }
  await next();
};

// Blocks anonymous Firebase users. Must be stacked AFTER requireAuth.
// Used to gate ping send/back/reject/revoke/dematch — anon can browse the app
// freely but cannot act on pings (PDD §3.8 with the agreed amendment that anon
// also can't reject, since reject is an action that affects another user).
export const requireLinkedAccount: MiddlewareHandler<AppEnv> = async (c, next) => {
  const provider = c.get("signInProvider");
  if (provider === "anonymous") {
    return c.json({ error: "linked_account_required" }, 403);
  }
  await next();
  return;
};

export function getUserId(c: Context<AppEnv>): string {
  const id = c.get("userId");
  if (!id) throw new Error("userId not set on context");
  return id;
}

export function maybeUserId(c: Context<AppEnv>): string | null {
  return c.get("userId") ?? null;
}
