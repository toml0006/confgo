import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

// Matches the server's PING_DECAY_DAYS. Kept in sync manually; if you bump
// one, bump the other.
const PING_DECAY_DAYS = 30;

// Live count of unanswered incoming pings for the Signals toolbar badge.
// PDD §9: pings where to_user_id == userId AND rejected_at == null, filtered
// client-side by the 30-day decay cutoff. Returns 0 while signed out.
export function useIncomingPingCount(userId: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    const q = query(
      collection(db, "pings"),
      where("to_user_id", "==", userId),
      where("rejected_at", "==", null),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const cutoff = new Date(Date.now() - PING_DECAY_DAYS * 86_400_000).toISOString();
        let active = 0;
        for (const d of snap.docs) {
          const createdAt = d.get("created_at") as string | undefined;
          if (createdAt && createdAt > cutoff) active += 1;
        }
        setCount(active);
      },
      (err) => console.error("[useIncomingPingCount]", err),
    );
    return () => unsub();
  }, [userId]);

  return count;
}
