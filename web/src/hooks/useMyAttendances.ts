import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { firestore } from "../config/firebase";

export function useMyAttendances(userId: string | null) {
  const [attendances, setAttendances] = useState<Map<string, "been" | "going">>(
    new Map()
  );

  useEffect(() => {
    if (!userId) {
      setAttendances(new Map());
      return;
    }
    const q = query(
      collection(firestore, "attendances"),
      where("user_id", "==", userId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const map = new Map<string, "been" | "going">();
      snap.forEach((doc) => {
        const d = doc.data() as { conference_id: string; intent: "been" | "going" };
        map.set(d.conference_id, d.intent);
      });
      setAttendances(map);
    });
    return unsub;
  }, [userId]);

  return attendances;
}
