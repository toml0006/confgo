import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Top-bar mode toggle — single button that flips light ↔ dark. Accent color
 * is fixed in `app.css`; past / future events have their own dedicated tokens
 * that intentionally don't track an accent picker.
 */
export function ThemePicker({ className }: { className?: string }) {
  const { mode, setMode } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setMode(mode === "light" ? "dark" : "light")}
      aria-label={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
      aria-pressed={mode === "dark"}
      className={cn(
        "inline-flex items-center justify-center size-7 rounded-full border border-hair text-ink2 hover:text-ink hover:border-ink3 transition-colors",
        className,
      )}
    >
      {mode === "light" ? (
        <SunIcon className="size-3.5" />
      ) : (
        <MoonIcon className="size-3.5" />
      )}
    </button>
  );
}
