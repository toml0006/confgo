import { useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { firestore } from "../config/firebase";

export function usePingUpdates(userId: string | null, onChange: () => void): void {
  useEffect(() => {
    if (!userId) return;
    const incomingQ = query(
      collection(firestore, "pings"),
      where("to_user_id", "==", userId)
    );
    const outgoingQ = query(
      collection(firestore, "pings"),
      where("from_user_id", "==", userId)
    );
    let remaining = 2; // skip the two initial snapshot callbacks
    const unsubA = onSnapshot(incomingQ, () => {
      if (remaining > 0) {
        remaining--;
        return;
      }
      onChange();
    });
    const unsubB = onSnapshot(outgoingQ, () => {
      if (remaining > 0) {
        remaining--;
        return;
      }
      onChange();
    });
    return () => {
      unsubA();
      unsubB();
    };
  }, [userId, onChange]);
}
