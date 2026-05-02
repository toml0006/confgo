import { Hono } from "hono";
import { cors } from "hono/cors";
import { getRequestListener } from "@hono/node-server";
import { onRequest } from "firebase-functions/v2/https";

import { AppEnv } from "./auth";
import { health } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { me } from "./routes/me";
import { conferenceRoutes } from "./routes/conferences";
import { pingRoutes } from "./routes/pings";
import { tagRoutes } from "./routes/tags";
import { userRoutes } from "./routes/users";
// TODO: co-attendance — add in later phase.

const routes = new Hono<AppEnv>();
routes.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

routes.route("/", health);
routes.route("/", authRoutes);
routes.route("/", me);
routes.route("/", conferenceRoutes);
routes.route("/", pingRoutes);
routes.route("/", tagRoutes);
routes.route("/", userRoutes);

routes.notFound((c) => c.json({ error: "not_found", path: c.req.path }, 404));
routes.onError((err, c) => {
  console.error("[api] unhandled", err);
  return c.json({ error: "internal", message: err.message }, 500);
});

const root = new Hono();
root.route("/", routes);
root.route("/api", routes);

export const api = onRequest(
  { region: "us-central1", invoker: "public" },
  getRequestListener(root.fetch) as never,
);

export {
  onUserCreated,
  onUserDeleted,
  onAttendanceCreated,
} from "./triggers/events";
