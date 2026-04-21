export type AttendanceIntent = "been" | "going";

export type PingIndicator = "incoming" | "outgoing" | "mutual" | null;

export interface UserRecord {
  id: string;
  avatarId: number;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string;
  isAdmin?: boolean;
}

export interface ConferenceRecord {
  id: string;
  name: string;
  locationName: string;
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
  source?: string;
  topics?: string[];
  url?: string | null;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  conferenceId: string;
  intent: AttendanceIntent;
  createdAt: string;
}

export interface PingRecord {
  id: string;
  fromUserId: string;
  toUserId: string;
  createdAt: string;
  rejectedAt: string | null;
}

export interface AttendeeSummary {
  id: string;
  avatarId: number;
  displayName: string | null;
  photoURL: string | null;
  intent: AttendanceIntent;
  youPinged?: boolean;
  hasPingedYou?: boolean;
}

export interface SharedConferenceSummary {
  conferenceId: string;
  name: string;
  locationName: string;
  startDate: string;
  endDate: string;
  latitude: number;
  longitude: number;
}

export interface CoAttendancePeer {
  user: Pick<UserRecord, "id" | "avatarId" | "displayName" | "photoURL">;
  sharedConferenceIds: string[];
  sharedCount: number;
  averageLatitude: number;
  averageLongitude: number;
  pingIndicator: PingIndicator;
}

export interface MutualContact {
  user: Pick<UserRecord, "id" | "avatarId" | "displayName" | "photoURL">;
  matchedAt: string;
}

export interface IncomingPing {
  pingId: string;
  user: Pick<UserRecord, "id" | "avatarId" | "displayName" | "photoURL">;
  createdAt: string;
}

export interface OutgoingPing {
  pingId: string;
  user: Pick<UserRecord, "id" | "avatarId" | "displayName" | "photoURL">;
  createdAt: string;
}

export interface MeResponse {
  id: string;
  avatarId: number;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAdmin: boolean;
}

export const AVATAR_GLYPHS = [
  "◆", "◇", "◈", "✦", "✧", "✶", "✷", "✹",
  "✺", "❖", "⬟", "⬢", "⬡", "▲", "△", "▶",
  "▷", "▼", "▽", "◀", "◁", "✱", "✲", "✳",
  "✴", "✵", "✸", "✻", "❈", "❉", "❊", "☀",
  "☼", "✢", "✣", "✤", "✥", "✦", "✧", "❂",
  "❄", "❅", "❆", "➤", "➥", "➦", "➧", "➳"
] as const;

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_PING_DECAY_DAYS = 30;

export function conferenceGlow(startDate: string, endDate: string, now = Date.now()): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 0;
  }
  if (start <= now && now <= end) {
    return 1;
  }
  const reference = now < start ? start : end;
  const days = Math.abs(now - reference) / DAY_MS;
  const decay = Math.exp(-days / 180);
  return Math.max(0.04, Math.min(1, decay));
}

export function pingIntensity(createdAt: string, now = Date.now(), decayDays = DEFAULT_PING_DECAY_DAYS): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) {
    return 0;
  }
  const ageDays = (now - created) / DAY_MS;
  if (ageDays <= 0) {
    return 1;
  }
  if (ageDays >= decayDays) {
    return 0;
  }
  return 1 - ageDays / decayDays;
}

export function isPastConference(endDate: string, now = Date.now()): boolean {
  return new Date(endDate).getTime() < now;
}

export function formatConferenceRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} - ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

export function coAttendanceCounts(peers: CoAttendancePeer[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const peer of peers) {
    for (const conferenceId of peer.sharedConferenceIds) {
      counts.set(conferenceId, (counts.get(conferenceId) ?? 0) + 1);
    }
  }
  return counts;
}

export function avatarPresentation(avatarId: number): { glyph: string; hue: number } {
  const glyph = AVATAR_GLYPHS[Math.abs(avatarId) % AVATAR_GLYPHS.length];
  const hue = (Math.abs(avatarId) * 37) % 360;
  return { glyph, hue };
}

export function displayNameOrFallback(user: Pick<UserRecord, "displayName" | "email">, anonymousLabel = "Anonymous"): string {
  if (user.displayName && user.displayName.trim()) {
    return user.displayName.trim();
  }
  return user.email ? "Unnamed" : anonymousLabel;
}

