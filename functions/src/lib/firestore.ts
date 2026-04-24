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
export const pingContacts = () => db.collection("ping_contacts");

// Collection shapes (documentation only — Firestore is schemaless).
//
// users/{userId}
//   avatar_id         number (0–47)
//   email             string | null
//   display_name      string | null
//   photo_url         string | null
//   created_at        string (ISO 8601)
//   saved_contacts    ContactEntry[]            // PDD §3.8 — contact cards the user
//                                               // picks from when sending a ping.
//                                               // Never leaves the server except as
//                                               // explicit disclosures on a ping.
//
// pings/{pingId}  (id = `${from_user_id}__${to_user_id}`)
//   from_user_id      string (→ users)
//   to_user_id        string (→ users)
//   created_at        string (ISO 8601)
//   rejected_at       string | null
//   — metadata only; contacts live in ping_contacts/{pingId} with stricter rules.
//
// ping_contacts/{pingId}  (same id as the matching ping doc)
//   owner_id          string (→ users)          // Always equals from_user_id of the
//                                               // matching ping. Rules restrict read
//                                               // to this user, so a ping recipient
//                                               // cannot read disclosures directly —
//                                               // they must come through the API,
//                                               // which fans them out only after
//                                               // mutual.
//   contacts          ContactEntry[]

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

export function pingId(fromUserId: string, toUserId: string): string {
  return `${fromUserId}__${toUserId}`;
}
