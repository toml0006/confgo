import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import type { AttendanceIntent } from "@shared/domain";

import { db } from "../lib/firebase";

export function useMyAttendances(user: User | null) {
  const [attendances, setAttendances] = useState<Map<string, AttendanceIntent>>(new Map());

  useEffect(() => {
    if (!user) {
      setAttendances(new Map());
      return;
    }

    const attendanceQuery = query(
      collection(db, "attendances"),
      where("user_id", "==", user.uid)
    );

    return onSnapshot(attendanceQuery, (snapshot) => {
      const next = new Map<string, AttendanceIntent>();
      for (const doc of snapshot.docs) {
        const data = doc.data();
        next.set(data.conference_id, data.intent as AttendanceIntent);
      }
      setAttendances(next);
    });
  }, [user]);

  return attendances;
}

