import { onRequest } from "firebase-functions/v2/https";
import { getRequestListener } from "@hono/node-server";
import { app } from "./app";

export const api = onRequest(
  {
    region: "us-central1",
    cors: false,
    memory: "512MiB",
    timeoutSeconds: 60,
  },
  (req, res) => {
    getRequestListener(app.fetch)(req, res);
  }
);
