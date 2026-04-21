import { auth } from "./firebase";

const BASE = "/api";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${path}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ——— shared API types ———

export type Conference = {
  id: string;
  name: string;
  locationName: string;
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
  source: string | null;
  topics: string[];
  url: string | null;
};

export type MeUser = {
  id: string;
  avatarId: number;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

export type AttendanceIntent = "been" | "going";

export type Attendee = {
  userId: string;
  intent: AttendanceIntent;
  avatarId: number;
  displayName: string | null;
  photoURL: string | null;
  isYou: boolean;
  youPinged: boolean;
  hasPingedYou: boolean;
};
