import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { db } from "../lib/firebase";

export function usePingRefresh(user: User | null) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) {
      setTick(0);
      return;
    }

    let seen = 0;
    const incoming = query(collection(db, "pings"), where("to_user_id", "==", user.uid));
    const outgoing = query(collection(db, "pings"), where("from_user_id", "==", user.uid));

    const bump = () => {
      seen += 1;
      if (seen > 2) {
        setTick((value) => value + 1);
      }
    };

    const unsubscribeIncoming = onSnapshot(incoming, bump);
    const unsubscribeOutgoing = onSnapshot(outgoing, bump);

    return () => {
      unsubscribeIncoming();
      unsubscribeOutgoing();
    };
  }, [user]);

  return tick;
}

