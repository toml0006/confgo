import { useEffect, useRef } from "react";
import type { Conference } from "../lib/types";
import { formatDateRange } from "../lib/dates";
import { CloseIcon } from "./icons";

interface Props {
  conferences: Conference[];
  myAttendances: Map<string, "been" | "going">;
  onPick: (c: Conference) => void;
  onClose: () => void;
}

export function LocationSheet({ conferences, myAttendances, onPick, onClose }: Props) {
  const nowRef = useRef<HTMLDivElement>(null);
  const now = Date.now();

  const sorted = [...conferences].sort((a, b) =>
    a.startDate.localeCompare(b.startDate)
  );
  const firstUpcomingIdx = sorted.findIndex((c) => Date.parse(c.endDate) >= now);

  useEffect(() => {
    nowRef.current?.scrollIntoView({ block: "center", behavior: "auto" });
  }, []);

  const location = sorted[0]?.locationName ?? "Conferences";

  return (
    <section className="sheet glass" role="region" aria-label={`Conferences in ${location}`}>
      <header className="sheet-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 className="sheet-title">{location}</h2>
          <p className="sheet-subtitle">
            {conferences.length} {conferences.length === 1 ? "conference" : "conferences"}
          </p>
        </div>
        <button className="close-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </header>
      <div className="sheet-body">
        {sorted.map((c, idx) => {
          const isPast = Date.parse(c.endDate) < now;
          const mine = myAttendances.get(c.id);
          const showNow = firstUpcomingIdx !== -1 && idx === firstUpcomingIdx;
          return (
            <div key={c.id}>
              {showNow && (
                <div className="list-divider" ref={nowRef}>
                  Now
                </div>
              )}
              <button
                className={`list-item${isPast ? " past" : ""}`}
                onClick={() => onPick(c)}
              >
                <div className="meta">
                  <span className="title">{c.name}</span>
                  <span className="sub">
                    {formatDateRange(c.startDate, c.endDate)}
                    {mine && (
                      <span
                        style={{
                          color: "var(--signal)",
                          marginLeft: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.14em",
                          fontSize: "0.62rem",
                        }}
                      >
                        {mine === "going" ? "Going" : "Attended"}
                      </span>
                    )}
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
