import { Fragment, useEffect, useRef } from "react";
import type { AttendanceIntent, Conference } from "../api";
import { isPast } from "../lib/decay";
import {
  FloatingPanel,
  FloatingPanelHeader,
} from "@/components/ui/floating-panel";
import { Kicker } from "@/components/ui/kicker";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";

type Props = {
  conferences: Conference[];
  locationName: string;
  myAttendances: Map<string, AttendanceIntent>;
  /** Conference id whose row should be highlighted + smooth-scrolled into
   *  view on mount. Used when the user clicks a specific dot on the map and
   *  the city has multiple events — we want the click target to land
   *  visually, not bury them in a list. */
  anchorId?: string;
  onPick: (conf: Conference) => void;
  onClose: () => void;
};

export function LocationSheet({
  conferences,
  locationName,
  anchorId,
  myAttendances,
  onPick,
  onClose,
}: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const nowDividerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const sorted = [...conferences].sort((a, b) =>
    a.startDate < b.startDate ? -1 : 1,
  );
  const now = new Date();
  const firstFutureIdx = sorted.findIndex((c) => new Date(c.startDate) > now);

  // Anchor wins over the NOW divider for default scroll position. Without
  // an anchor we land near "now" so future events read first.
  useEffect(() => {
    if (anchorId) {
      const row = rowRefs.current.get(anchorId);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    if (nowDividerRef.current && listRef.current) {
      const parent = listRef.current;
      const child = nowDividerRef.current;
      parent.scrollTop = child.offsetTop - parent.offsetTop - 80;
    }
  }, [anchorId]);

  return (
    <FloatingPanel side="top-left" onClose={onClose} className="gap-3.5">
      <FloatingPanelHeader>
        <div className="flex flex-col gap-1.5">
          <Kicker>{sorted.length} conferences</Kicker>
          <h2 className="m-0 font-display text-[1.4rem] font-normal leading-[1.1] tracking-[-0.025em] text-ink">
            {locationName}
          </h2>
        </div>
      </FloatingPanelHeader>

      <div ref={listRef} className="overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
        {sorted.map((c, i) => {
          const past = isPast(c.endDate, now);
          const mine = myAttendances.has(c.id);
          const showDivider = i === firstFutureIdx && firstFutureIdx > 0;
          const isAnchor = c.id === anchorId;
          const nameColor = mine
            ? past
              ? "text-past-mine"
              : "text-future-mine"
            : past
              ? "text-past"
              : "text-ink";
          return (
            <Fragment key={c.id}>
              {showDivider ? (
                <div
                  ref={nowDividerRef}
                  className="flex items-center gap-2 my-3 first:mt-0 before:content-[''] before:flex-1 before:h-px before:bg-future after:content-[''] after:flex-1 after:h-px after:bg-future"
                >
                  <span className="text-[10px] font-semibold tracking-[0.22em] uppercase text-future">
                    NOW
                  </span>
                </div>
              ) : null}
              <button
                ref={(el) => {
                  if (el) rowRefs.current.set(c.id, el);
                  else rowRefs.current.delete(c.id);
                }}
                onClick={() => onPick(c)}
                className={cn(
                  "grid grid-cols-[110px_1fr_auto] gap-2.5 items-baseline w-full text-left px-2.5 py-2 border rounded-[10px] transition-colors",
                  isAnchor
                    ? "border-brand bg-brand-soft"
                    : "border-transparent hover:border-hair hover:bg-hair-soft",
                )}
              >
                <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink3">
                  {new Date(c.startDate).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span
                  className={`font-display text-[14px] overflow-hidden text-ellipsis whitespace-nowrap ${nameColor}`}
                >
                  {c.name}
                </span>
                {mine ? (
                  // Label is derived from temporal context, not the stored
                  // intent — a future conf always reads "Going", even if
                  // the user originally marked "been" on it (data drift,
                  // re-scheduled events, etc).
                  <Tag tone={past ? "past" : "future"}>
                    {past ? "Been" : "Going"}
                  </Tag>
                ) : null}
              </button>
            </Fragment>
          );
        })}
      </div>
    </FloatingPanel>
  );
}
