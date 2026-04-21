import { useEffect } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";

import { db } from "../lib/firebase";

export function useConferenceUpdates(enabled: boolean, onChange: () => void) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let initial = true;
    const conferenceQuery = query(
      collection(db, "conferences"),
      orderBy("created_at", "desc"),
      limit(1)
    );

    return onSnapshot(conferenceQuery, () => {
      if (initial) {
        initial = false;
        return;
      }
      onChange();
    });
  }, [enabled, onChange]);
}

