import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { firestore } from "../config/firebase";
import { PING_DECAY_DAYS } from "../lib/decay";

export function useIncomingPingCount(userId: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    const q = query(
      collection(firestore, "pings"),
      where("to_user_id", "==", userId),
      where("rejected_at", "==", null)
    );
    const unsub = onSnapshot(q, (snap) => {
      const cutoff = Date.now() - PING_DECAY_DAYS * 86_400_000;
      let live = 0;
      snap.forEach((doc) => {
        const d = doc.data() as { created_at: string };
        if (Date.parse(d.created_at) >= cutoff) live++;
      });
      setCount(live);
    });
    return unsub;
  }, [userId]);

  return count;
}
