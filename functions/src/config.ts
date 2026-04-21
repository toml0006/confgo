export const PROJECT_ID =
  process.env.GCLOUD_PROJECT ??
  process.env.FIREBASE_CONFIG_PROJECT_ID ??
  "demo-confgo";

export const IS_PRODUCTION =
  process.env.NODE_ENV === "production" ||
  PROJECT_ID === "confgo";

export const PING_DECAY_DAYS = Number(process.env.PING_DECAY_DAYS ?? "30");

export const REGION = process.env.FUNCTION_REGION ?? "us-central1";

