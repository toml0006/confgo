import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const auth = admin.auth();

export const users = () => db.collection("users");
export const conferences = () => db.collection("conferences");
export const attendances = () => db.collection("attendances");
export const pings = () => db.collection("pings");

export async function getUsersByIds(
  ids: string[],
): Promise<Map<string, FirebaseFirestore.DocumentData>> {
  const out = new Map<string, FirebaseFirestore.DocumentData>();
  if (ids.length === 0) return out;
  for (const batch of chunk(ids, 100)) {
    const refs = batch.map((id) => users().doc(id));
    const docs = await db.getAll(...refs);
    for (const d of docs) {
      if (d.exists) out.set(d.id, d.data()!);
    }
  }
  return out;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function attendanceId(userId: string, conferenceId: string): string {
  return `${userId}__${conferenceId}`;
}
