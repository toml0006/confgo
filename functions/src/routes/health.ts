import { Hono } from "hono";
import { conferences } from "../lib/firestore";
import { AppEnv } from "../auth";

export const health = new Hono<AppEnv>();

health.get("/health", async (c) => {
  const snap = await conferences().count().get();
  return c.json({
    ok: true,
    conferenceCount: snap.data().count,
    database: "firestore",
  });
});
