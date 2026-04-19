import { MiddlewareHandler } from "hono";
import { auth, db } from "../lib/firestore";
import type { HonoVars, UserDoc } from "../lib/types";
import { forbidden, unauthenticated } from "../lib/errors";

async function provisionUser(uid: string, email: string | null): Promise<UserDoc> {
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    const doc = snap.data() as UserDoc;
    if (email && doc.email !== email) {
      await ref.update({ email });
      doc.email = email;
    }
    return doc;
  }
  const doc: UserDoc = {
    avatar_id: Math.floor(Math.random() * 48),
    email,
    display_name: null,
    photo_url: null,
    is_admin: false,
    created_at: new Date().toISOString(),
  };
  await ref.set(doc);
  return doc;
}

export const optionalAuth: MiddlewareHandler<HonoVars> = async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return next();
  const token = header.slice(7);
  try {
    const decoded = await auth.verifyIdToken(token);
    const userDoc = await provisionUser(decoded.uid, decoded.email ?? null);
    c.set("uid", decoded.uid);
    c.set("user", { id: decoded.uid, ...userDoc });
    const provider = decoded.firebase?.sign_in_provider;
    c.set("isLinked", !!provider && provider !== "anonymous");
  } catch {
    // ignore; treat as unauthenticated
  }
  await next();
};

export const requireAuth: MiddlewareHandler<HonoVars> = async (c, next) => {
  if (!c.get("uid")) throw unauthenticated();
  await next();
};

export const requireLinked: MiddlewareHandler<HonoVars> = async (c, next) => {
  if (!c.get("uid")) throw unauthenticated();
  if (!c.get("isLinked"))
    throw forbidden("This action requires a linked account. Sign up from Settings.");
  await next();
};

export const requireAdmin: MiddlewareHandler<HonoVars> = async (c, next) => {
  const user = c.get("user");
  if (!user) throw unauthenticated();
  if (!user.is_admin) throw forbidden("Admin privileges required.");
  await next();
};
