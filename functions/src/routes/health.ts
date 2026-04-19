import { Hono } from "hono";
import { db } from "../lib/firestore";
import type { HonoVars } from "../lib/types";

export const healthRoutes = new Hono<HonoVars>();

healthRoutes.get("/", async (c) => {
  const count = (await db.collection("conferences").count().get()).data().count;
  return c.json({ ok: true, conferenceCount: count, database: "firestore" });
});
