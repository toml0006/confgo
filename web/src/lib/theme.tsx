import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark";

type Settings = {
  mode: ThemeMode;
};

type ThemeContextValue = Settings & {
  setMode: (m: ThemeMode) => void;
};

const DEFAULTS: Settings = {
  mode: "light",
};

const STORAGE_KEY = "vb.theme.v1";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      mode: parsed.mode === "dark" ? "dark" : "light",
    };
  } catch {
    return DEFAULTS;
  }
}

function applyToDocument(s: Settings) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.dataset.mode = s.mode;
  el.style.colorScheme = s.mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => readStored());

  useEffect(() => {
    applyToDocument(settings);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore quota / privacy mode
    }
  }, [settings]);

  const setMode = useCallback(
    (mode: ThemeMode) => setSettings((s) => ({ ...s, mode })),
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ ...settings, setMode }),
    [settings, setMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
