import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import type { AttendanceIntent } from "../api";

export type AttendanceMap = Map<string, AttendanceIntent>;

export function useMyAttendances(userId: string | null): AttendanceMap {
  const [map, setMap] = useState<AttendanceMap>(() => new Map());

  useEffect(() => {
    if (!userId) {
      setMap(new Map());
      return;
    }
    const q = query(collection(db, "attendances"), where("user_id", "==", userId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: AttendanceMap = new Map();
        for (const d of snap.docs) {
          const data = d.data() as { conference_id: string; intent: AttendanceIntent };
          next.set(data.conference_id, data.intent);
        }
        setMap(next);
      },
      (err) => console.error("[useMyAttendances]", err),
    );
    return () => unsub();
  }, [userId]);

  return map;
}
