import crypto from "node:crypto";
import type { QueryDocumentSnapshot, Timestamp } from "firebase-admin/firestore";

import type {
  AttendanceRecord,
  AttendanceIntent,
  AttendeeSummary,
  CoAttendancePeer,
  ConferenceRecord,
  IncomingPing,
  MutualContact,
  OutgoingPing,
  PingIndicator,
  PingRecord,
  SharedConferenceSummary,
  UserRecord
} from "../../shared/domain.js";

export interface AuthContext {
  uid: string;
  email: string | null;
  isAdmin: boolean;
  rawToken: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function randomAvatarId(seed: string): number {
  const hash = crypto.createHash("sha256").update(seed).digest();
  return hash[0]! % 48;
}

export function stableConferenceId(name: string, startDate: string): string {
  return `rc_${crypto.createHash("sha256").update(`${name.toLowerCase()}|${startDate}`).digest("hex").slice(0, 16)}`;
}

export function seedId(prefix: string, name: string): string {
  return `${prefix}_${crypto.createHash("sha256").update(name).digest("hex").slice(0, 16)}`;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function normalizeTimestamp(value: unknown): string {
  if (!value) {
    return nowIso();
  }
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (isTimestamp(value)) {
    return value.toDate().toISOString();
  }
  return nowIso();
}

function isTimestamp(value: unknown): value is Timestamp {
  return value !== null && typeof value === "object" && "toDate" in value;
}

export function docToUser(snapshot: QueryDocumentSnapshot): UserRecord {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    avatarId: data.avatar_id ?? 0,
    email: data.email ?? null,
    displayName: data.display_name ?? null,
    photoURL: data.photo_url ?? null,
    createdAt: normalizeTimestamp(data.created_at)
  };
}

export function docToConference(snapshot: QueryDocumentSnapshot): ConferenceRecord {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: data.name,
    locationName: data.location_name,
    latitude: data.latitude,
    longitude: data.longitude,
    startDate: data.start_date,
    endDate: data.end_date,
    source: data.source,
    topics: data.topics,
    url: data.url ?? null,
    createdAt: normalizeTimestamp(data.created_at)
  };
}

export function docToAttendance(snapshot: QueryDocumentSnapshot): AttendanceRecord {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    userId: data.user_id,
    conferenceId: data.conference_id,
    intent: data.intent as AttendanceIntent,
    createdAt: normalizeTimestamp(data.created_at)
  };
}

export function docToPing(snapshot: QueryDocumentSnapshot): PingRecord {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    fromUserId: data.from_user_id,
    toUserId: data.to_user_id,
    createdAt: normalizeTimestamp(data.created_at),
    rejectedAt: data.rejected_at ? normalizeTimestamp(data.rejected_at) : null
  };
}

export function toUserSummary(user: UserRecord): Pick<UserRecord, "id" | "avatarId" | "displayName" | "photoURL"> {
  return {
    id: user.id,
    avatarId: user.avatarId,
    displayName: user.displayName,
    photoURL: user.photoURL
  };
}

export function toAttendee(user: UserRecord, intent: AttendanceIntent, youPinged = false, hasPingedYou = false): AttendeeSummary {
  return {
    id: user.id,
    avatarId: user.avatarId,
    displayName: user.displayName,
    photoURL: user.photoURL,
    intent,
    youPinged,
    hasPingedYou
  };
}

export function toSharedConferenceSummary(conference: ConferenceRecord): SharedConferenceSummary {
  return {
    conferenceId: conference.id,
    name: conference.name,
    locationName: conference.locationName,
    startDate: conference.startDate,
    endDate: conference.endDate,
    latitude: conference.latitude,
    longitude: conference.longitude
  };
}

export function activePingCutoffIso(decayDays: number): string {
  return new Date(Date.now() - decayDays * 24 * 60 * 60 * 1000).toISOString();
}

export function isPingActive(ping: Pick<PingRecord, "createdAt">, decayDays: number): boolean {
  return ping.createdAt >= activePingCutoffIso(decayDays);
}

export function resolvePingIndicator(params: {
  outgoing: boolean;
  outgoingRejected: boolean;
  incoming: boolean;
}): PingIndicator {
  if (params.outgoing && !params.outgoingRejected && params.incoming) {
    return "mutual";
  }
  if (params.incoming) {
    return "incoming";
  }
  if (params.outgoing) {
    return "outgoing";
  }
  return null;
}

export function buildCoAttendancePeer(
  user: UserRecord,
  sharedConferenceIds: string[],
  conferencesById: Map<string, ConferenceRecord>,
  pingIndicator: PingIndicator
): CoAttendancePeer {
  const coords = sharedConferenceIds
    .map((conferenceId) => conferencesById.get(conferenceId))
    .filter((conference): conference is ConferenceRecord => Boolean(conference));

  const averageLatitude =
    coords.reduce((sum, conference) => sum + conference.latitude, 0) / Math.max(coords.length, 1);
  const averageLongitude =
    coords.reduce((sum, conference) => sum + conference.longitude, 0) / Math.max(coords.length, 1);

  return {
    user: toUserSummary(user),
    sharedConferenceIds,
    sharedCount: sharedConferenceIds.length,
    averageLatitude,
    averageLongitude,
    pingIndicator
  };
}

export function incomingPingResponse(user: UserRecord, ping: PingRecord): IncomingPing {
  return {
    pingId: ping.id,
    user: toUserSummary(user),
    createdAt: ping.createdAt
  };
}

export function outgoingPingResponse(user: UserRecord, ping: PingRecord): OutgoingPing {
  return {
    pingId: ping.id,
    user: toUserSummary(user),
    createdAt: ping.createdAt
  };
}

export function mutualContact(user: UserRecord, matchedAt: string): MutualContact {
  return {
    user: toUserSummary(user),
    matchedAt
  };
}
