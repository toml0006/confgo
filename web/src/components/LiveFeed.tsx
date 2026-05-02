import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./UserAvatar";
import type { LiveEvent, LiveEventType } from "../hooks/useLiveFeed";

type Props = {
  events: LiveEvent[];
};

const ACCENT: Record<LiveEventType, string> = {
  account_created: "bg-future",
  account_deleted: "bg-brand",
  match_added: "bg-future-mine",
};

const KICKER_LABEL: Record<LiveEventType, string> = {
  account_created: "Joined",
  account_deleted: "Departed",
  match_added: "Match",
};

const KICKER_TEXT: Record<LiveEventType, string> = {
  account_created: "text-future",
  account_deleted: "text-brand",
  match_added: "text-future-mine",
};

function actorName(name: string | null): string {
  return name && name.length > 0 ? name : "Someone";
}

function intentVerb(intent: "been" | "going" | undefined): string {
  if (intent === "been") return "marked attended";
  if (intent === "going") return "is going to";
  return "added";
}

export function LiveFeed({ events }: Props) {
  const navigate = useNavigate();
  return (
    <div
      aria-label="Live activity feed"
      className={cn(
        // Anchored to the left edge below the toolbar, above the footer.
        "fixed left-[18px] top-[78px] bottom-[60px] z-30",
        "w-[300px] max-w-[calc(100vw-36px)]",
        // Stack items at the bottom; new arrivals push the column upward,
        // so old items drift toward the masked top edge before TTL evicts them.
        "flex flex-col justify-end gap-1.5",
        // Mask the top so events fade into the map instead of clipping hard.
        "[mask-image:linear-gradient(to_bottom,transparent_0,black_72px,black_calc(100%-8px),transparent_100%)]",
        // Container ignores pointer events; individual rows opt back in so the
        // map underneath stays clickable in the gaps between feed items.
        "pointer-events-none",
        "overflow-hidden",
      )}
    >
      {events.map((evt, idx) => {
        const isNewest = idx === events.length - 1;
        const conf = evt.conf;
        const handleClick =
          evt.type === "match_added" && conf
            ? () => navigate(`/c/${conf.id}`)
            : evt.type !== "account_deleted"
              ? () => navigate(`/u/${evt.actor.id}`)
              : undefined;
        return (
          <div
            key={evt.id}
            data-newest={isNewest || undefined}
            className={cn(
              "vb-live-row pointer-events-auto",
              "group relative flex items-start gap-2.5",
              "rounded-[12px] border border-hair/60",
              "bg-paper/65 backdrop-blur-md",
              "px-2.5 py-2",
              "shadow-[0_2px_10px_rgba(15,23,42,0.06)]",
              "transition-[opacity,transform] duration-300",
              handleClick && "cursor-pointer hover:border-hair hover:bg-paper/85",
            )}
            onClick={handleClick}
            role={handleClick ? "button" : undefined}
            tabIndex={handleClick ? 0 : undefined}
            onKeyDown={
              handleClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleClick();
                    }
                  }
                : undefined
            }
          >
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-2 bottom-2 w-[3px] rounded-r-[3px]",
                ACCENT[evt.type],
              )}
            />
            {evt.type === "account_deleted" ? (
              <span
                aria-hidden
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-hair-soft text-ink3 font-display italic text-[14px]"
              >
                ·
              </span>
            ) : (
              <UserAvatar
                avatarId={evt.actor.avatarId}
                displayName={evt.actor.displayName}
                photoURL={evt.actor.photoUrl}
                size="sm"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div
                className={cn(
                  "font-ui text-[9px] font-semibold uppercase tracking-[var(--tracking-kicker)]",
                  KICKER_TEXT[evt.type],
                )}
              >
                {KICKER_LABEL[evt.type]}
              </div>
              <div className="font-display text-[12.5px] leading-[1.35] text-ink line-clamp-2">
                {evt.type === "match_added" && conf ? (
                  <>
                    <span className="font-medium">{actorName(evt.actor.displayName)}</span>{" "}
                    <span className="text-ink2 italic">{intentVerb(evt.intent)}</span>{" "}
                    <span className="font-medium">{conf.name}</span>
                  </>
                ) : evt.type === "account_created" ? (
                  <>
                    <span className="font-medium">{actorName(evt.actor.displayName)}</span>{" "}
                    <span className="text-ink2 italic">just signed in</span>
                  </>
                ) : (
                  <span className="text-ink2 italic">An account vanished</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
