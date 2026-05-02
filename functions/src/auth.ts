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

// Falls back to the Firebase UserRecord when the ID token's `name` / `picture`
// / `email` claims are missing. This happens when a user signs in anonymously
// and then links Google/GitHub via `linkWithPopup`: the linked provider's
// `displayName` / `photoURL` land on `providerData[]` but Firebase does not
// auto-promote them to the top-level User properties that the ID token reads
// from. UserRecord exposes both, so we can resolve the gap server-side without
// trusting the client to do an `updateProfile` call.
type ResolvedClaims = {
  claims: IdentityClaims;
  lookedUp: boolean; // true iff `auth.getUser()` actually returned (no early-out, no throw)
};

async function resolveClaimsFromUserRecord(
  userId: string,
  claims: IdentityClaims,
): Promise<ResolvedClaims> {
  if (claims.email && claims.name && claims.picture) {
    return { claims, lookedUp: false };
  }
  try {
    const rec = await auth.getUser(userId);
    const fromProviders = (
      pick: (p: admin.auth.UserInfo) => string | null | undefined,
    ): string | null => {
      for (const p of rec.providerData ?? []) {
        const v = pick(p);
        if (typeof v === "string" && v.length > 0) return v;
      }
      return null;
    };
    const recordEmail =
      rec.emailVerified && rec.email && rec.email.length > 0 ? rec.email : null;
    return {
      claims: {
        email: claims.email ?? recordEmail,
        name:
          claims.name ??
          (rec.displayName && rec.displayName.length > 0 ? rec.displayName : null) ??
          fromProviders((p) => p.displayName),
        picture:
          claims.picture ??
          (rec.photoURL && rec.photoURL.length > 0 ? rec.photoURL : null) ??
          fromProviders((p) => p.photoURL),
      },
      lookedUp: true,
    };
  } catch (_err) {
    // Transient lookup failure: don't stamp the sticky marker, so the next
    // request gets another shot at backfilling.
    return { claims, lookedUp: false };
  }
}

async function ensureUserDoc(
  userId: string,
  rawClaims: IdentityClaims,
  signInProvider: string | null,
) {
  const ref = users().doc(userId);
  const snap = await ref.get();
  // Skip the Admin SDK lookup for anonymous users: they have no provider data
  // to fall back to, and `display_name` / `photo_url` will always be null,
  // which would otherwise force an `auth.getUser` call on every authed request
  // during normal anonymous browsing.
  const isAnonymous = signInProvider === "anonymous";
  // `provider_lookup_done` is a sticky marker that we've already consulted
  // UserRecord for this user. Without it, a linked user with a legitimately
  // empty UserRecord field (e.g. GitHub account with no avatar) would keep
  // hitting `auth.getUser` on every request forever. The flag costs us the
  // chance to auto-pick up a *later* avatar/name change on the provider — an
  // acceptable tradeoff; users can re-link or PATCH /me to refresh.
  const lookupDone = snap.exists && snap.get("provider_lookup_done") === true;
  const docNeedsFill =
    !isAnonymous &&
    !lookupDone &&
    (!snap.exists ||
      !snap.get("display_name") ||
      !snap.get("photo_url") ||
      !snap.get("email"));
  const resolved = docNeedsFill
    ? await resolveClaimsFromUserRecord(userId, rawClaims)
    : { claims: rawClaims, lookedUp: false };
  const claims = resolved.claims;

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
      // Stamp the sticky marker only if `auth.getUser()` actually ran. New
      // docs created from a fully-populated token leave it unset, so any
      // future field-clear can still trigger a UserRecord fallback. Transient
      // lookup failures also leave it unset, preserving retry on next request.
      provider_lookup_done: resolved.lookedUp,
      created_at: nowIso(),
    });
    return;
  }
  const data = snap.data()!;
  const patch: Record<string, unknown> = {};
  if (claims.email && data.email !== claims.email) patch.email = claims.email;
  if (resolved.lookedUp) patch.provider_lookup_done = true;
  // Fill display_name / photo_url whenever they're null and we have a value.
  // Tradeoff: a user who clears either field via Settings PATCH /me will see
  // it re-populated from provider data on their next authed request. We accept
  // this — the prior `oauth_profile_synced` flag was meant to honor manual
  // clears but ended up sticking on null values when token claims didn't
  // arrive (the anon-then-link case), permanently blocking the very backfill
  // it was supposed to gate. Simpler "fill when null" is more robust; if a
  // user truly wants no avatar/name we can revisit with a sentinel later.
  if (claims.name && !data.display_name) patch.display_name = claims.name;
  if (claims.picture && !data.photo_url) patch.photo_url = claims.picture;
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
    const signInProvider = signInProviderOf(decoded);
    c.set("userId", decoded.uid);
    c.set("email", claims.email);
    c.set("signInProvider", signInProvider);
    await ensureUserDoc(decoded.uid, claims, signInProvider);
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
