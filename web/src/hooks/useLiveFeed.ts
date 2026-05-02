import { useEffect, useMemo, useRef, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

export type LiveEventType = "account_created" | "account_deleted" | "match_added";

export type LiveActor = {
  id: string;
  displayName: string | null;
  avatarId: number;
  photoUrl: string | null;
};

export type LiveConf = {
  id: string;
  name: string;
  locationName: string;
  topics: string[];
};

export type LiveEvent = {
  id: string;
  type: LiveEventType;
  ts: string;
  actor: LiveActor;
  conf?: LiveConf;
  intent?: "been" | "going";
  /** Local wall-clock time the client first observed this event. Drives the fade-out clock. */
  addedAt: number;
};

type UseLiveFeedOptions = {
  myId: string | null;
  myConferenceIds: ReadonlySet<string>;
  myTopics: ReadonlySet<string>;
  /** Max simultaneous visible items. Older ones drop off the top. */
  maxVisible?: number;
  /** Milliseconds an item stays in the visible window before being evicted. */
  ttlMs?: number;
};

const DEFAULT_MAX = 7;
const DEFAULT_TTL = 14_000;

// Skip the snapshot's pre-existing backlog so the rail doesn't slam open with
// 50 stale events on first load. Anything written more than this many ms before
// the listener attaches is treated as history and never animates in.
const BACKLOG_GRACE_MS = 4_000;

function passesFilter(
  raw: Omit<LiveEvent, "addedAt">,
  myId: string | null,
  myConferenceIds: ReadonlySet<string>,
  myTopics: ReadonlySet<string>,
): boolean {
  if (!myId) return false;
  if (raw.actor.id === myId) return false;
  if (raw.type === "account_created" || raw.type === "account_deleted") return true;
  if (raw.type === "match_added") {
    if (!raw.conf) return false;
    if (myConferenceIds.has(raw.conf.id)) return true;
    for (const t of raw.conf.topics) {
      if (myTopics.has(t)) return true;
    }
    return false;
  }
  return false;
}

export function useLiveFeed({
  myId,
  myConferenceIds,
  myTopics,
  maxVisible = DEFAULT_MAX,
  ttlMs = DEFAULT_TTL,
}: UseLiveFeedOptions): LiveEvent[] {
  const [items, setItems] = useState<LiveEvent[]>([]);
  // Track which doc ids we've already surfaced so resnapshots don't re-add or
  // reset the addedAt clock when an unrelated event arrives.
  const seen = useRef<Set<string>>(new Set());
  // Stable refs of the filter inputs so the snapshot listener doesn't re-subscribe
  // every time the parent's set identity changes.
  const filtersRef = useRef({ myId, myConferenceIds, myTopics });
  filtersRef.current = { myId, myConferenceIds, myTopics };

  // Reset internal state when the viewer changes (e.g. sign-out).
  useEffect(() => {
    seen.current = new Set();
    setItems([]);
  }, [myId]);

  // Firestore subscription.
  useEffect(() => {
    if (!myId) return;
    const attachedAt = Date.now();
    const q = query(collection(db, "events"), orderBy("ts", "desc"), limit(50));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const fresh: LiveEvent[] = [];
        const now = Date.now();
        const filters = filtersRef.current;
        // Iterate oldest→newest so appended order matches stream order.
        for (const change of snap.docChanges()) {
          if (change.type !== "added") continue;
          const d = change.doc;
          if (seen.current.has(d.id)) continue;
          const data = d.data();
          const raw = {
            id: d.id,
            type: data.type as LiveEventType,
            ts: (data.ts as string) ?? new Date().toISOString(),
            actor: data.actor as LiveActor,
            conf: data.conf as LiveConf | undefined,
            intent: data.intent as "been" | "going" | undefined,
          };
          if (!passesFilter(raw, filters.myId, filters.myConferenceIds, filters.myTopics)) {
            seen.current.add(d.id);
            continue;
          }
          // Drop pre-listener backlog so we don't dump history on first attach.
          const eventTime = Date.parse(raw.ts);
          const isBacklog =
            Number.isFinite(eventTime) &&
            now - attachedAt < 1_000 &&
            now - eventTime > BACKLOG_GRACE_MS;
          if (isBacklog) {
            seen.current.add(d.id);
            continue;
          }
          seen.current.add(d.id);
          fresh.push({ ...raw, addedAt: now });
        }
        if (fresh.length === 0) return;
        // Newer events have larger addedAt, so sort ascending and keep tail.
        fresh.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
        setItems((prev) => [...prev, ...fresh].slice(-maxVisible));
      },
      (err) => console.error("[useLiveFeed]", err),
    );
    return () => unsub();
  }, [myId, maxVisible]);

  // TTL eviction. One interval, scans current items and drops the expired.
  useEffect(() => {
    if (items.length === 0) return;
    const tick = () => {
      const cutoff = Date.now() - ttlMs;
      setItems((prev) => {
        const next = prev.filter((it) => it.addedAt > cutoff);
        return next.length === prev.length ? prev : next;
      });
    };
    const handle = window.setInterval(tick, 500);
    return () => window.clearInterval(handle);
  }, [items.length, ttlMs]);

  return items;
}

// Helper: derive the viewer's topic set from their attendance list.
// Unioned across every conference they've marked been/going on.
export function useMyTopics(
  conferenceById: ReadonlyMap<string, { topics: string[] }>,
  myConferenceIds: ReadonlySet<string>,
): Set<string> {
  return useMemo(() => {
    const out = new Set<string>();
    for (const id of myConferenceIds) {
      const conf = conferenceById.get(id);
      if (!conf) continue;
      for (const t of conf.topics) out.add(t);
    }
    return out;
  }, [conferenceById, myConferenceIds]);
}
