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
  UserCredential,
  getAdditionalUserInfo,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase";
import { apiFetch } from "../api";
import { normalizeContact, type ContactEntry } from "../lib/contacts";

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
    case "github.com": {
      const p = new GithubAuthProvider();
      // GitHub's default `read:user` scope omits private email addresses; opt
      // in so the ID token's `email` claim is populated for users who haven't
      // set a public email on their profile.
      p.addScope("user:email");
      return p;
    }
  }
}

// `linkWithPopup` attaches the provider's displayName/photoURL to
// `user.providerData[]` but does not promote them onto the top-level User
// record, so subsequent ID tokens lack `name`/`picture` claims for the
// anon-then-link path. Copy from providerData when the User record's own
// fields are empty so the next minted token carries the claims and the
// backend can read them via the standard channel. Best-effort — backend has a
// UserRecord fallback that handles the same gap.
async function syncProfileFromProviderData(user: User): Promise<void> {
  const provider = user.providerData[0];
  if (!provider) return;
  const nextName = !user.displayName && provider.displayName ? provider.displayName : null;
  const nextPhoto = !user.photoURL && provider.photoURL ? provider.photoURL : null;
  if (!nextName && !nextPhoto) return;
  try {
    await updateProfile(user, {
      ...(nextName ? { displayName: nextName } : {}),
      ...(nextPhoto ? { photoURL: nextPhoto } : {}),
    });
  } catch (err) {
    console.warn("[auth] profile sync from provider data failed", err);
  }
}

// GitHub usernames live in the OAuth profile, not the verified ID token, so
// the backend can't seed them on its own. After a successful link, push the
// handle into saved_contacts (idempotent — skip if the user already has any
// github card or has hit the cap).
async function seedGithubHandleFromCred(cred: UserCredential): Promise<void> {
  const info = getAdditionalUserInfo(cred);
  if (info?.providerId !== "github.com") return;
  const profile = info.profile as { login?: unknown } | null | undefined;
  const login = typeof profile?.login === "string" ? profile.login : null;
  if (!login) return;
  try {
    const current = await apiFetch<{ contacts: ContactEntry[] }>("/me/contacts");
    if (current.contacts.some((c) => c.type === "github")) return;
    const next = [
      ...current.contacts,
      normalizeContact({ type: "github", value: login }),
    ];
    await apiFetch("/me/contacts", {
      method: "PUT",
      body: JSON.stringify({ contacts: next }),
    });
  } catch (err) {
    // Seeding is best-effort; the user can still add the handle manually.
    console.warn("[auth] github handle seed failed", err);
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
        await syncProfileFromProviderData(cred.user);
        setUser(cred.user);
        await seedGithubHandleFromCred(cred);
        // Hard reload so every user-scoped fetch (/me, attendances,
        // pings) re-runs with the upgraded identity instead of trying
        // to reconcile post-link state in place.
        window.location.reload();
        return;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== "auth/credential-already-in-use") throw err;
        // Credential already belongs to another Firebase user. Re-opening a
        // popup here would be blocked — the original click gesture was
        // consumed by linkWithPopup. Fall back to signInWithRedirect, which
        // doesn't require a fresh gesture; the page reloads into the
        // existing account when Google posts the result back.
        await signInWithRedirect(auth, provider);
        return;
      }
    }
    const cred = await signInWithPopup(auth, provider);
    await syncProfileFromProviderData(cred.user);
    setUser(cred.user);
    await seedGithubHandleFromCred(cred);
    window.location.reload();
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
