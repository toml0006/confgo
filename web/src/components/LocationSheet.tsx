import { Fragment, useEffect, useRef } from "react";
import type { AttendanceIntent, Conference } from "../api";
import { isPast } from "../lib/decay";

type Props = {
  conferences: Conference[];
  locationName: string;
  myAttendances: Map<string, AttendanceIntent>;
  onPick: (conf: Conference) => void;
  onClose: () => void;
};

export function LocationSheet({
  conferences,
  locationName,
  myAttendances,
  onPick,
  onClose,
}: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const nowDividerRef = useRef<HTMLDivElement | null>(null);

  // sort chronological ascending
  const sorted = [...conferences].sort((a, b) =>
    a.startDate < b.startDate ? -1 : 1,
  );
  const now = new Date();
  const firstFutureIdx = sorted.findIndex((c) => new Date(c.startDate) > now);

  useEffect(() => {
    // auto-scroll to NOW divider
    if (nowDividerRef.current && listRef.current) {
      const parent = listRef.current;
      const child = nowDividerRef.current;
      parent.scrollTop = child.offsetTop - parent.offsetTop - 80;
    }
  }, []);

  return (
    <div className="loc-sheet glass-panel sheet-in">
      <div className="loc-head">
        <div>
          <div className="section-label">{sorted.length} conferences</div>
          <h2 className="loc-name">{locationName}</h2>
        </div>
        <button className="close-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="loc-list" ref={listRef}>
        {sorted.map((c, i) => {
          const past = isPast(c.endDate, now);
          const mine = myAttendances.has(c.id);
          const showDivider = i === firstFutureIdx && firstFutureIdx > 0;
          return (
            <Fragment key={c.id}>
              {showDivider ? (
                <div className="now-divider" ref={nowDividerRef}>
                  <span>NOW</span>
                </div>
              ) : null}
              <button
                onClick={() => onPick(c)}
                className={`loc-row ${past ? "past" : "future"} ${mine ? "mine" : ""}`}
              >
                <span className="loc-row-date">
                  {new Date(c.startDate).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="loc-row-name">{c.name}</span>
                {mine ? (
                  <span className="loc-row-flag">
                    {myAttendances.get(c.id)}
                  </span>
                ) : null}
              </button>
            </Fragment>
          );
        })}
      </div>

      <style>{`
        .loc-sheet {
          position: fixed;
          top: 92px;
          left: 18px;
          width: min(420px, calc(100vw - 36px));
          max-height: calc(100vh - 110px);
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          z-index: 40;
        }
        .loc-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }
        .loc-name {
          margin: 6px 0 0 0;
          font-size: 1.2rem;
          font-weight: 400;
        }
        .loc-list {
          overflow-y: auto;
          max-height: calc(100vh - 220px);
          padding-right: 4px;
        }
        .now-divider {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0.75rem 0 0.5rem 0;
        }
        .now-divider::before,
        .now-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--signal-dim);
        }
        .now-divider span {
          font-size: 0.6rem;
          letter-spacing: 0.2em;
          color: var(--signal);
        }
        .loc-row {
          display: grid;
          grid-template-columns: 110px 1fr auto;
          gap: 0.6rem;
          align-items: baseline;
          width: 100%;
          text-align: left;
          padding: 0.55rem 0.6rem;
          border: 1px solid transparent;
          border-radius: 10px;
          font-size: 0.82rem;
        }
        .loc-row:hover {
          border-color: var(--mist);
          background: rgba(232, 240, 255, 0.03);
        }
        .loc-row.past {
          color: var(--text-muted);
        }
        .loc-row.mine.past {
          color: var(--past-signal);
        }
        .loc-row.mine {
          color: var(--signal);
        }
        .loc-row-date {
          font-size: 0.62rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: inherit;
          opacity: 0.75;
        }
        .loc-row-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .loc-row-flag {
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--signal);
          border: 1px solid var(--signal-dim);
          border-radius: 999px;
          padding: 0.1rem 0.45rem;
        }
      `}</style>
    </div>
  );
}
