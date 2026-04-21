import { useEffect, useState } from "react";
import {
  EmailAuthProvider,
  User,
  createUserWithEmailAndPassword,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";

import { auth, ensureFirebaseEmulators, googleProvider } from "../lib/firebase";
import { apiFetch } from "../lib/api";
import { env } from "../env";

export function useAuthSession() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureFirebaseEmulators();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setReady(true);
        return;
      }

      try {
        if (env.devSessionUserId) {
          const session = await apiFetch<{ customToken: string }>("/auth/dev-session", {
            method: "POST",
            body: JSON.stringify({ userId: env.devSessionUserId })
          });
          await signInWithCustomToken(auth, session.customToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch {
        await signInAnonymously(auth);
      }
      setReady(true);
    });

    return unsubscribe;
  }, []);

  return {
    user,
    ready,
    async linkEmailPassword(email: string, password: string) {
      if (!auth.currentUser) {
        return;
      }
      if (auth.currentUser.isAnonymous) {
        await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(email, password));
        return;
      }
      await createUserWithEmailAndPassword(auth, email, password);
    },
    async signInEmailPassword(email: string, password: string) {
      await signInWithEmailAndPassword(auth, email, password);
    },
    async signInGoogle() {
      if (auth.currentUser?.isAnonymous) {
        await linkWithPopup(auth.currentUser, googleProvider);
        return;
      }
      await signInWithPopup(auth, googleProvider);
    },
    async linkGoogle() {
      if (!auth.currentUser) {
        return;
      }
      await linkWithPopup(auth.currentUser, googleProvider);
    },
    async signOutCurrent() {
      await signOut(auth);
    }
  };
}

