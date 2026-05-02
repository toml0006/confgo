import { useEffect, useRef, useState } from "react";
import {
  apiFetch,
  type Conference,
  type PublicUser,
  type TagsResponse,
} from "../api";

const DEBOUNCE_MS = 260;

let tagsCache: TagsResponse | null = null;
let tagsInflight: Promise<TagsResponse> | null = null;
export async function loadTags(): Promise<TagsResponse> {
  if (tagsCache) return tagsCache;
  if (!tagsInflight) {
    tagsInflight = apiFetch<TagsResponse>("/tags").then((r) => {
      tagsCache = r;
      tagsInflight = null;
      return r;
    });
  }
  return tagsInflight;
}

export function getTagsCache() {
  return tagsCache;
}

type Result = {
  conferences: Conference[];
  people: PublicUser[];
  loading: boolean;
};

/**
 * Debounced search across /conferences and /users. Re-fires whenever `q` or
 * `tags` change. Returns the latest results plus a loading flag. Stale
 * requests are ignored via a sequence counter.
 */
export function useGlobalSearch(q: string, tags: string[]): Result {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);
  const requestSeq = useRef(0);

  useEffect(() => {
    requestSeq.current += 1;
    const seq = requestSeq.current;
    const hasQuery = q.trim().length > 0;
    const hasTags = tags.length > 0;
    if (!hasQuery && !hasTags) {
      setConferences([]);
      setPeople([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const params = new URLSearchParams();
      if (hasQuery) params.set("q", q.trim());
      if (hasTags) params.set("tags", tags.join(","));
      const confPromise = apiFetch<{ conferences: Conference[] }>(
        `/conferences?${params.toString()}`,
      );
      const userPromise = hasQuery
        ? apiFetch<{ users: PublicUser[] }>(
            `/users?q=${encodeURIComponent(q.trim())}`,
          )
        : Promise.resolve({ users: [] });
      const [confRes, userRes] = await Promise.allSettled([
        confPromise,
        userPromise,
      ]);
      if (seq !== requestSeq.current) return;
      if (confRes.status === "fulfilled")
        setConferences(confRes.value.conferences);
      else console.error(confRes.reason);
      if (userRes.status === "fulfilled") setPeople(userRes.value.users);
      else console.error(userRes.reason);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [q, tags]);

  return { conferences, people, loading };
}
