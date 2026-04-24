import { db, pingContacts, pings } from "./firestore";
import type { ContactEntry } from "./contacts";

// PDD §3.8: pings fade after 30 days. Configurable via env for dev.
export const PING_DECAY_DAYS = Number(process.env.PING_DECAY_DAYS ?? "30");
export const PING_RATE_LIMIT_PER_DAY = 20;

export function pingDecayCutoffIso(now: Date = new Date()): string {
  return new Date(now.getTime() - PING_DECAY_DAYS * 86_400_000).toISOString();
}

export function userPublic(id: string, data: FirebaseFirestore.DocumentData | undefined) {
  return {
    id,
    avatarId: data?.avatar_id ?? 0,
    displayName: data?.display_name ?? null,
    photoURL: data?.photo_url ?? null,
  };
}

// Metadata-only view of a ping. Contacts live in ping_contacts and must be
// loaded via loadContactsForPings() — only for outgoing + mutual surfaces.
export type PingDoc = {
  id: string;
  fromUserId: string;
  toUserId: string;
  createdAt: string;
  rejectedAt: string | null;
};

function toPingDoc(d: FirebaseFirestore.QueryDocumentSnapshot): PingDoc {
  return {
    id: d.id,
    fromUserId: d.get("from_user_id"),
    toUserId: d.get("to_user_id"),
    createdAt: d.get("created_at"),
    rejectedAt: d.get("rejected_at") ?? null,
  };
}

export type PingState = {
  activeIncoming: PingDoc[];
  activeOutgoing: PingDoc[];
  mutualPeerIds: Set<string>;
  incomingOnlyPeerIds: Set<string>;
  outgoingOnlyPeerIds: Set<string>;
  allOutgoingDocs: PingDoc[]; // includes rejected (for rate-limit + silent no-op)
};

export async function loadPingState(userId: string, now: Date = new Date()): Promise<PingState> {
  const cutoff = pingDecayCutoffIso(now);
  const [incomingSnap, outgoingSnap] = await Promise.all([
    pings().where("to_user_id", "==", userId).get(),
    pings().where("from_user_id", "==", userId).get(),
  ]);
  const allIncoming = incomingSnap.docs.map(toPingDoc);
  const allOutgoing = outgoingSnap.docs.map(toPingDoc);

  const isActive = (p: PingDoc) => p.rejectedAt === null && p.createdAt > cutoff;
  const activeIncoming = allIncoming.filter(isActive);
  const activeOutgoing = allOutgoing.filter(isActive);

  const incomingPeers = new Set(activeIncoming.map((p) => p.fromUserId));
  const outgoingPeers = new Set(activeOutgoing.map((p) => p.toUserId));

  const mutualPeerIds = new Set<string>();
  for (const id of incomingPeers) if (outgoingPeers.has(id)) mutualPeerIds.add(id);

  const incomingOnlyPeerIds = new Set<string>();
  for (const id of incomingPeers) if (!mutualPeerIds.has(id)) incomingOnlyPeerIds.add(id);
  const outgoingOnlyPeerIds = new Set<string>();
  for (const id of outgoingPeers) if (!mutualPeerIds.has(id)) outgoingOnlyPeerIds.add(id);

  return {
    activeIncoming,
    activeOutgoing,
    mutualPeerIds,
    incomingOnlyPeerIds,
    outgoingOnlyPeerIds,
    allOutgoingDocs: allOutgoing,
  };
}

// Batch-fetch ping_contacts by ping id. Returns a map; missing ids yield [].
export async function loadContactsForPings(
  pingIds: string[],
): Promise<Map<string, ContactEntry[]>> {
  const out = new Map<string, ContactEntry[]>();
  if (pingIds.length === 0) return out;
  const refs = pingIds.map((id) => pingContacts().doc(id));
  const docs = await db.getAll(...refs);
  for (const d of docs) {
    out.set(d.id, ((d.data()?.contacts as ContactEntry[] | undefined) ?? []));
  }
  return out;
}
