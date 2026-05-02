import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
} from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

export const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(firebaseApp);
// `experimentalAutoDetectLongPolling` makes Firestore try WebChannel
// first and fall back to long polling if the streaming transport fails.
// Safari's Intelligent Tracking Prevention frequently blocks WebChannel
// to firestore.googleapis.com — without this, post-signin /Listen
// streams error with "access control checks" / "transport errored" on
// Safari + iOS. Slight first-listen latency cost (~100ms); no behavior
// change in Chrome / Firefox where WebChannel works.
export const db = initializeFirestore(firebaseApp, {
  experimentalAutoDetectLongPolling: true,
});
export const storage = getStorage(firebaseApp);

if (useEmulators) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8180);
  connectStorageEmulator(storage, "localhost", 9199);
}
