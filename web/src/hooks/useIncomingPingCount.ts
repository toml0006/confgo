import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { pingIntensity } from "@shared/domain";

import { db } from "../lib/firebase";

export function useIncomingPingCount(user: User | null) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    const pingQuery = query(
      collection(db, "pings"),
      where("to_user_id", "==", user.uid),
      where("rejected_at", "==", null)
    );

    return onSnapshot(pingQuery, (snapshot) => {
      const nextCount = snapshot.docs.reduce((total, doc) => {
        const data = doc.data();
        return total + (pingIntensity(data.created_at) > 0 ? 1 : 0);
      }, 0);
      setCount(nextCount);
    });
  }, [user]);

  return count;
}

