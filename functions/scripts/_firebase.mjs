import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { applicationDefault, initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

export async function resolveProjectId(production) {
  if (!production) {
    return "demo-confgo";
  }
  const firebaserc = JSON.parse(await fs.readFile(path.join(repoRoot, ".firebaserc"), "utf8"));
  return firebaserc.projects?.default ?? "confgo";
}

export async function initFirebase({ production = false } = {}) {
  const projectId = await resolveProjectId(production);

  if (!production) {
    process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= "127.0.0.1:9199";
  }

  if (!getApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    initializeApp(serviceAccount
      ? { credential: cert(JSON.parse(serviceAccount)), projectId }
      : { credential: applicationDefault(), projectId });
  }

  return {
    projectId,
    repoRoot,
    auth: getAuth(),
    db: getFirestore()
  };
}

export function shaId(prefix, input) {
  return `${prefix}_${cryptoHash(input).slice(0, 16)}`;
}

export function cryptoHash(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function mulberry32(seed) {
  let current = seed >>> 0;
  return () => {
    current += 0x6d2b79f5;
    let value = Math.imul(current ^ (current >>> 15), 1 | current);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
