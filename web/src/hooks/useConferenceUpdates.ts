import { useEffect } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

export function useConferenceUpdates(callback: () => void) {
  useEffect(() => {
    const q = query(collection(db, "conferences"), orderBy("created_at", "desc"), limit(1));
    let firstSnapshot = true;
    const unsub = onSnapshot(
      q,
      () => {
        if (firstSnapshot) {
          firstSnapshot = false;
          return;
        }
        callback();
      },
      (err) => console.error("[useConferenceUpdates]", err),
    );
    return () => unsub();
  }, [callback]);
}
