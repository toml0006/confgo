import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { authRoutes } from "./routes/auth";
import { meRoutes } from "./routes/me";
import { conferenceRoutes } from "./routes/conferences";
import { userRoutes } from "./routes/users";
import { pingRoutes } from "./routes/pings";
import { healthRoutes } from "./routes/health";

const inner = new Hono();

inner.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return "*";
      if (/^http:\/\/localhost:(5174|4300|5300)$/.test(origin)) return origin;
      if (/\.firebaseapp\.com$/.test(origin)) return origin;
      if (/\.web\.app$/.test(origin)) return origin;
      return "";
    },
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 600,
    credentials: false,
  })
);

inner.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  const uid = c.get("uid" as never) || "-";
  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      method: c.req.method,
      path: c.req.path,
      uid,
      status: c.res.status,
      ms,
    })
  );
});

inner.route("/auth", authRoutes);
inner.route("/me", meRoutes);
inner.route("/conferences", conferenceRoutes);
inner.route("/users", userRoutes);
inner.route("/pings", pingRoutes);
inner.route("/health", healthRoutes);

inner.onError((err, c) => {
  if (err instanceof HTTPException) {
    const res = err.getResponse();
    if (res.headers.get("content-type")?.includes("json")) return res;
    return c.json(
      {
        error: {
          code: statusToCode(err.status),
          message: err.message || "Request failed.",
        },
      },
      err.status
    );
  }
  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: "validation_failed",
          message: "Request validation failed.",
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      400
    );
  }
  console.error(
    JSON.stringify({
      t: new Date().toISOString(),
      err: { message: (err as Error).message, stack: (err as Error).stack },
    })
  );
  return c.json({ error: { code: "internal", message: "Internal server error." } }, 500);
});

inner.notFound((c) =>
  c.json({ error: { code: "not_found", message: `Route ${c.req.path} not found.` } }, 404)
);

function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return "validation_failed";
    case 401:
      return "unauthenticated";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 429:
      return "rate_limited";
    default:
      return status >= 500 ? "internal" : "error";
  }
}

export const app = new Hono();
app.route("/", inner);
app.route("/api", inner);
