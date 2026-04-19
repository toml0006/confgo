import { initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  signInAnonymously,
  signInWithCustomToken,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  initializeFirestore,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "1";

// In emulator mode, the Firebase SDK just needs any non-empty apiKey — the
// emulator accepts any token. Fall back to demo values so `.env` is only
// required for production builds or when pointing at a real project.
const emulatorDefaults = {
  apiKey: "demo-api-key",
  authDomain: "demo-confgo.firebaseapp.com",
  projectId: "demo-confgo",
  storageBucket: "demo-confgo.appspot.com",
  appId: "1:0:web:0",
};

const config = useEmulators
  ? {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || emulatorDefaults.apiKey,
      authDomain:
        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || emulatorDefaults.authDomain,
      projectId:
        import.meta.env.VITE_FIREBASE_PROJECT_ID || emulatorDefaults.projectId,
      storageBucket:
        import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || emulatorDefaults.storageBucket,
      appId: import.meta.env.VITE_FIREBASE_APP_ID || emulatorDefaults.appId,
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

if (!useEmulators && !config.apiKey) {
  throw new Error(
    "Firebase config is missing. Set VITE_FIREBASE_* vars in web/.env or enable emulators with VITE_USE_FIREBASE_EMULATORS=1."
  );
}

export const firebaseApp = initializeApp(config);

export const auth = getAuth(firebaseApp);
export const firestore = initializeFirestore(firebaseApp, {
  // Emulator's WebChannel streaming is flaky across Safari and corporate
  // proxies; long-polling falls back cleanly.
  experimentalAutoDetectLongPolling: true,
});
export const storage = getStorage(firebaseApp);

if (useEmulators) {
  connectAuthEmulator(auth, "http://localhost:9399", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "localhost", 8380);
  connectStorageEmulator(storage, "localhost", 9499);
}

const devUserId =
  useEmulators && import.meta.env.VITE_DEV_USER_ID
    ? String(import.meta.env.VITE_DEV_USER_ID)
    : null;

async function signInAsDevUser(userId: string): Promise<User | null> {
  try {
    const res = await fetch("/api/auth/dev-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      console.warn(`Dev-session for ${userId} failed: ${res.status}`);
      return null;
    }
    const { customToken } = (await res.json()) as { customToken: string };
    const cred = await signInWithCustomToken(auth, customToken);
    return cred.user;
  } catch (err) {
    console.warn("Dev-session request failed, falling back to anonymous:", err);
    return null;
  }
}

export async function bootstrapAuth(): Promise<User> {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      // If a dev user is pinned and we're signed in as someone else, swap.
      if (devUserId && user && user.uid !== devUserId) {
        await signOut(auth);
        return; // onAuthStateChanged will fire again with null
      }
      if (user) {
        unsub();
        resolve(user);
        return;
      }
      try {
        if (devUserId) {
          const dev = await signInAsDevUser(devUserId);
          if (dev) {
            unsub();
            resolve(dev);
            return;
          }
        }
        const cred = await signInAnonymously(auth);
        unsub();
        resolve(cred.user);
      } catch (err) {
        console.error("Sign-in failed", err);
      }
    });
  });
}

export function isLinkedUser(user: User | null): boolean {
  if (!user) return false;
  return user.providerData.some((p) => p.providerId !== "anonymous");
}
