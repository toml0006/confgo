import { useNavigate } from "react-router-dom";
import { SearchIcon } from "lucide-react";
import { Wordmark } from "@/components/ui/wordmark";
import { Tag } from "@/components/ui/tag";
import { ThemePicker } from "@/components/ui/theme-picker";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import type { MeUser } from "@/api";

type Props = {
  myCount: number;
  signalsCount: number;
  showPast: boolean;
  showFuture: boolean;
  onTogglePast: (next: boolean) => void;
  onToggleFuture: (next: boolean) => void;
  onOpenSettings: () => void;
  onOpenMyConferences: () => void;
  onOpenSignals: () => void;
  onOpenSearch: () => void;
  me?: MeUser | null;
};

type NavPillProps = {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  indicator?: boolean;
};

function NavPill({ active, onClick, children, ariaLabel, indicator }: NavPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] sm:text-[13px] sm:px-3 transition-colors whitespace-nowrap",
        active ? "bg-hair-soft text-ink" : "text-ink2 hover:text-ink",
      )}
    >
      {children}
      {indicator ? (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-brand"
        />
      ) : null}
    </button>
  );
}

export function Toolbar({
  myCount,
  signalsCount,
  showPast,
  showFuture,
  onTogglePast,
  onToggleFuture,
  onOpenSettings,
  onOpenMyConferences,
  onOpenSignals,
  onOpenSearch,
  me,
}: Props) {
  const navigate = useNavigate();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-30 h-[60px] bg-paper border-b border-hair flex items-center px-2 sm:px-4 gap-2 sm:gap-4"
      role="banner"
    >
      <Wordmark onClick={() => navigate("/")} />

      {/* Search trigger — icon-only on mobile, full search bar on sm+. */}
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Open search"
        className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-full bg-bg border border-hair text-ink2 hover:text-ink hover:border-ink3 transition-colors w-9 sm:w-[260px] sm:max-w-[40vw] shrink-0 sm:shrink"
      >
        <SearchIcon className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline flex-1 text-left text-[12px] truncate">
          Search conferences, people…
        </span>
        <kbd className="hidden sm:inline-flex font-mono text-[10px] text-ink2 px-1.5 py-px rounded border border-hair bg-paper">
          ⌘K
        </kbd>
      </button>

      {/* Time range filter — hidden on mobile (reach via My conferences). */}
      <div
        role="group"
        aria-label="Time range filter"
        className="hidden md:flex items-center gap-1.5"
      >
        <Tag tone="past" active={showPast} onClick={() => onTogglePast(!showPast)}>
          Past
        </Tag>
        <Tag tone="future" active={showFuture} onClick={() => onToggleFuture(!showFuture)}>
          Future
        </Tag>
      </div>

      <nav aria-label="Primary" className="ml-auto flex items-center gap-0 sm:gap-1 min-w-0">
        <NavPill onClick={onOpenMyConferences} ariaLabel="My conferences">
          <span className="sm:hidden">Mine</span>
          <span className="hidden sm:inline">My conferences</span>
          {myCount > 0 ? (
            <span className="text-ink3 text-[10px] sm:text-[11px]">{myCount}</span>
          ) : null}
        </NavPill>
        <NavPill
          onClick={onOpenSignals}
          indicator={signalsCount > 0}
          ariaLabel={
            signalsCount > 0 ? `Signals (${signalsCount} unread)` : "Signals"
          }
        >
          Signals
        </NavPill>
      </nav>

      <ThemePicker className="hidden sm:flex" />

      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Open settings"
        className="rounded-full p-0.5 transition-colors hover:bg-hair-soft shrink-0"
      >
        <UserAvatar
          avatarId={me?.avatarId ?? 0}
          photoURL={me?.photoURL ?? null}
          displayName={me?.displayName ?? null}
          size="sm"
        />
      </button>
    </header>
  );
}
