import { useEffect, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { firestore } from "../config/firebase";
import { listConferences } from "../lib/api";
import type { Conference } from "../lib/types";

export function useConferences(): { conferences: Conference[]; loading: boolean } {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { conferences } = await listConferences();
        if (!cancelled) setConferences(conferences);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    // live-listen for newly-added conferences
    const q = query(
      collection(firestore, "conferences"),
      orderBy("created_at", "desc"),
      limit(1)
    );
    let first = true;
    const unsub = onSnapshot(q, () => {
      if (first) {
        first = false;
        return;
      }
      listConferences().then(({ conferences }) => {
        if (!cancelled) setConferences(conferences);
      });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { conferences, loading };
}
