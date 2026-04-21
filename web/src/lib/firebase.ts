import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  connectAuthEmulator,
  initializeAuth
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore
} from "firebase/firestore";
import {
  connectStorageEmulator,
  getStorage
} from "firebase/storage";

import { env } from "../env";

const app = initializeApp(env.firebase);

export const auth = initializeAuth(app, {
  persistence: env.useEmulators ? browserSessionPersistence : browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver
});
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

let emulatorsConnected = false;

if (env.useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  emulatorsConnected = true;
}

export function ensureFirebaseEmulators() {
  if (!env.useEmulators || emulatorsConnected) {
    return;
  }
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  emulatorsConnected = true;
}
