import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { db, conferences, users, nowIso } from "../lib/firestore";

// Global live feed events. Server-only writes (Admin SDK bypasses rules).
// Single collection; clients subscribe with orderBy(ts desc).limit(50) and
// filter "match" events locally against their own profile.
//
// Document shape:
//   type        "account_created" | "account_deleted" | "match_added"
//   ts          ISO 8601 — drives ordering and client-side TTL fade
//   actor       { id, displayName, avatarId, photoUrl }   (omitted when unknown)
//   conf        { id, name, locationName, topics }        (match_added only)
//   intent      "been" | "going"                          (match_added only)

const events = () => db.collection("events");

const REGION = "us-central1";

type ActorPayload = {
  id: string;
  displayName: string | null;
  avatarId: number;
  photoUrl: string | null;
};

function actorFromUser(
  id: string,
  data: FirebaseFirestore.DocumentData | undefined,
): ActorPayload {
  return {
    id,
    displayName: (data?.display_name as string | null) ?? null,
    avatarId: (data?.avatar_id as number | undefined) ?? 0,
    photoUrl: (data?.photo_url as string | null) ?? null,
  };
}

export const onUserCreated = onDocumentCreated(
  { document: "users/{userId}", region: REGION },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    // Skip pure-anonymous signups so the live rail isn't flooded with the
    // "Someone signed in" rows that incognito traffic generates. Once an
    // anon user links Google/GitHub we'll see them via attendance events.
    const hasIdentity =
      typeof data.display_name === "string" && data.display_name.length > 0;
    const hasEmail = typeof data.email === "string" && data.email.length > 0;
    if (!hasIdentity && !hasEmail) return;
    const userId = event.params.userId;
    await events().add({
      type: "account_created",
      ts: nowIso(),
      created_at: FieldValue.serverTimestamp(),
      actor: actorFromUser(userId, data),
    });
  },
);

export const onUserDeleted = onDocumentDeleted(
  { document: "users/{userId}", region: REGION },
  async (event) => {
    const snap = event.data;
    const userId = event.params.userId;
    await events().add({
      type: "account_deleted",
      ts: nowIso(),
      created_at: FieldValue.serverTimestamp(),
      actor: actorFromUser(userId, snap?.data()),
    });
  },
);

export const onAttendanceCreated = onDocumentCreated(
  { document: "attendances/{attendanceId}", region: REGION },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const userId = data.user_id as string | undefined;
    const confId = data.conference_id as string | undefined;
    const intent = data.intent as "been" | "going" | undefined;
    if (!userId || !confId || !intent) return;

    const [userSnap, confSnap] = await Promise.all([
      users().doc(userId).get(),
      conferences().doc(confId).get(),
    ]);
    if (!confSnap.exists) return;
    const confData = confSnap.data()!;

    await events().add({
      type: "match_added",
      ts: nowIso(),
      created_at: FieldValue.serverTimestamp(),
      actor: actorFromUser(userId, userSnap.data()),
      intent,
      conf: {
        id: confId,
        name: (confData.name as string) ?? "",
        locationName: (confData.location_name as string) ?? "",
        topics: (confData.topics as string[] | undefined) ?? [],
      },
    });
  },
);
