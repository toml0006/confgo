import { Context, MiddlewareHandler } from "hono";
import * as admin from "firebase-admin";
import { auth, users, nowIso } from "./lib/firestore";
import { MAX_SAVED_CONTACTS, normalizeContact } from "./lib/contacts";

export type AppEnv = {
  Variables: {
    userId: string;
    email: string | null;
    signInProvider: string | null;
  };
};

const AVATAR_COUNT = 48;

type IdentityClaims = {
  email: string | null;
  name: string | null;
  picture: string | null;
};

// Pulls email + name + picture out of the verified ID token. Google and GitHub
// both populate these claims via Firebase's identity toolkit; anonymous users
// have all three null. We only trust `email` when `email_verified` is true —
// the email seeds saved_contacts, which is sensitive enough to gate.
function identityClaimsOf(decoded: {
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  picture?: unknown;
}): IdentityClaims {
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;
  const verified = decoded.email_verified === true;
  return {
    email: verified ? str(decoded.email) : null,
    name: str(decoded.name),
    picture: str(decoded.picture),
  };
}

async function ensureUserDoc(userId: string, claims: IdentityClaims) {
  const ref = users().doc(userId);
  const snap = await ref.get();
  if (!snap.exists) {
    const seeded = claims.email
      ? [normalizeContact({ type: "email", value: claims.email })]
      : [];
    await ref.set({
      avatar_id: Math.floor(Math.random() * AVATAR_COUNT),
      email: claims.email,
      display_name: claims.name,
      photo_url: claims.picture,
      saved_contacts: seeded,
      // Marker for one-shot OAuth backfill. Set on creation; once present,
      // PATCH /me is the only writer for display_name / photo_url, so a user
      // who clears either value via Settings is not re-overwritten on the
      // next authed request.
      oauth_profile_synced: true,
      created_at: nowIso(),
    });
    return;
  }
  const data = snap.data()!;
  const patch: Record<string, unknown> = {};
  if (claims.email && data.email !== claims.email) patch.email = claims.email;
  // One-shot backfill for users created before OAuth claims were captured.
  // Once `oauth_profile_synced` is set, do not auto-fill again — that would
  // undo a deliberate clear from Settings.
  // Tradeoff: a legacy user who already cleared display_name or photo_url
  // before this flag existed will see those fields re-populated from OAuth on
  // their next authed request. Acceptable one-time event; subsequent clears
  // are honored.
  if (!data.oauth_profile_synced) {
    if (claims.name && !data.display_name) patch.display_name = claims.name;
    if (claims.picture && !data.photo_url) patch.photo_url = claims.picture;
    patch.oauth_profile_synced = true;
  }
  if (claims.email) {
    const existing = Array.isArray(data.saved_contacts) ? data.saved_contacts : [];
    const lower = claims.email.toLowerCase();
    const hasEmail = existing.some(
      (c: { type?: unknown; value?: unknown }) =>
        c?.type === "email" &&
        typeof c.value === "string" &&
        c.value.toLowerCase() === lower,
    );
    // Use arrayUnion so concurrent writers (this middleware running on
    // parallel /api requests, or the frontend's GitHub-handle seed) merge
    // their additions instead of clobbering. Cap respected against the
    // pre-write length to match `savedContactsArraySchema`.
    if (!hasEmail && existing.length < MAX_SAVED_CONTACTS) {
      patch.saved_contacts = admin.firestore.FieldValue.arrayUnion(
        normalizeContact({ type: "email", value: claims.email }),
      );
    }
  }
  if (Object.keys(patch).length > 0) {
    await ref.update(patch);
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
    const claims = identityClaimsOf(decoded);
    c.set("userId", decoded.uid);
    c.set("email", claims.email);
    c.set("signInProvider", signInProviderOf(decoded));
    await ensureUserDoc(decoded.uid, claims);
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
      const claims = identityClaimsOf(decoded);
      c.set("userId", decoded.uid);
      c.set("email", claims.email);
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
