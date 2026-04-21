import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AuthProvider as FbAuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  User,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase";

export type AuthProviderId = "google.com" | "github.com";

type AuthValue = {
  user: User | null;
  ready: boolean;
  isAnonymous: boolean;
  getIdToken: () => Promise<string | null>;
  linkProvider: (id: AuthProviderId) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

function providerFor(id: AuthProviderId): FbAuthProvider {
  switch (id) {
    case "google.com":
      return new GoogleAuthProvider();
    case "github.com":
      return new GithubAuthProvider();
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (cancelled) return;
      if (u) {
        setUser(u);
        setReady(true);
        return;
      }
      try {
        const cred = await signInAnonymously(auth);
        if (!cancelled) setUser(cred.user);
      } catch (err) {
        console.error("[auth] anonymous sign-in failed", err);
      } finally {
        if (!cancelled) setReady(true);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const linkProvider = useCallback(async (id: AuthProviderId) => {
    const provider = providerFor(id);
    const current = auth.currentUser;
    if (current?.isAnonymous) {
      try {
        const cred = await linkWithPopup(current, provider);
        setUser(cred.user);
        return;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== "auth/credential-already-in-use") throw err;
        // Credential already belongs to another account — fall through to signIn.
      }
    }
    const cred = await signInWithPopup(auth, provider);
    setUser(cred.user);
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    // onAuthStateChanged will kick off a fresh anonymous session.
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      isAnonymous: user?.isAnonymous ?? true,
      getIdToken: async () => (user ? user.getIdToken() : null),
      linkProvider,
      signOutUser,
    }),
    [user, ready, linkProvider, signOutUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
