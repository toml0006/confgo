import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { auth, db } from "../lib/firestore";
import { forbidden } from "../lib/errors";
import { serializeUser } from "../lib/serialize";
import type { HonoVars, UserDoc } from "../lib/types";

export const authRoutes = new Hono<HonoVars>();

const isEmulator =
  !!process.env.FUNCTIONS_EMULATOR ||
  !!process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  process.env.NODE_ENV !== "production";

authRoutes.post(
  "/dev-session",
  zValidator("json", z.object({ userId: z.string().min(1) })),
  async (c) => {
    if (!isEmulator) throw forbidden("Dev sessions are disabled in production.");
    const { userId } = c.req.valid("json");
    const customToken = await auth.createCustomToken(userId);
    const snap = await db.collection("users").doc(userId).get();
    const user = snap.exists ? serializeUser(userId, snap.data() as UserDoc) : null;
    return c.json({ customToken, user });
  }
);
