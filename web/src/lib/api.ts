import type { User } from "firebase/auth";

import { env } from "../env";

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  user?: User | null
): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", "application/json");

  if (user) {
    const token = await user.getIdToken();
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const error = await response.json();
      if (error.error) {
        message = error.error;
      }
    } catch {
      // Ignore parse failure.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

