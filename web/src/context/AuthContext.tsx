import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { auth, bootstrapAuth, isLinkedUser } from "../config/firebase";
import { getMe } from "../lib/api";
import type { User } from "../lib/types";
import {
  onAuthStateChanged,
  type User as FbUser,
} from "firebase/auth";

interface AuthContextValue {
  fbUser: FbUser | null;
  user: User | null;
  loading: boolean;
  isLinked: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [fbUser, setFbUser] = useState<FbUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    bootstrapAuth().then(() => {
      if (cancelled) return;
    });
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      if (!u) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const me = await getMe();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const refresh = async () => {
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      // noop
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      fbUser,
      user,
      loading,
      isLinked: isLinkedUser(fbUser),
      refresh,
    }),
    [fbUser, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
