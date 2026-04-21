import { onRequest } from "firebase-functions/v2/https";

import { REGION } from "./config.js";
import { requestListener } from "./app.js";

export const api = onRequest(
  {
    region: REGION,
    cors: true
  },
  requestListener
);
