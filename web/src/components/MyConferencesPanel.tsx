import { useMemo } from "react";
import type { AttendanceIntent, Conference } from "../api";
import { isPast } from "../lib/decay";

type Props = {
  conferences: Conference[];
  myAttendances: Map<string, AttendanceIntent>;
  onPick: (conf: Conference) => void;
  onClose: () => void;
};

export function MyConferencesPanel({
  conferences,
  myAttendances,
  onPick,
  onClose,
}: Props) {
  const { going, been } = useMemo(() => {
    const now = new Date();
    const mine = conferences.filter((c) => myAttendances.has(c.id));
    const going: Conference[] = [];
    const been: Conference[] = [];
    for (const c of mine) {
      if (isPast(c.endDate, now)) been.push(c);
      else going.push(c);
    }
    going.sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
    been.sort((a, b) => (a.endDate > b.endDate ? -1 : 1));
    return { going, been };
  }, [conferences, myAttendances]);

  return (
    <div className="my-panel glass-panel sheet-in">
      <div className="my-head">
        <h2 className="my-title">My conferences</h2>
        <button className="close-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="section-label signal-tint">Going ({going.length})</div>
      {going.length === 0 ? (
        <div className="caption">Nothing marked for the future.</div>
      ) : (
        <div className="my-list">
          {going.map((c) => (
            <button key={c.id} className="my-row mine" onClick={() => onPick(c)}>
              <span className="my-row-date signal-tint">
                {new Date(c.startDate).toLocaleDateString()}
              </span>
              <span className="my-row-name">{c.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="section-label rose-tint">Been ({been.length})</div>
      {been.length === 0 ? (
        <div className="caption">Nothing marked in the past.</div>
      ) : (
        <div className="my-list">
          {been.map((c) => (
            <button key={c.id} className="my-row mine past" onClick={() => onPick(c)}>
              <span className="my-row-date rose-tint">
                {new Date(c.startDate).toLocaleDateString()}
              </span>
              <span className="my-row-name">{c.name}</span>
            </button>
          ))}
        </div>
      )}

      <style>{`
        .my-panel {
          position: fixed;
          top: 68px;
          right: 18px;
          width: min(360px, calc(100vw - 36px));
          max-height: calc(100vh - 86px);
          overflow-y: auto;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          z-index: 40;
        }
        .my-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .my-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 400;
          letter-spacing: 0.06em;
        }
        .signal-tint {
          color: var(--signal);
        }
        .rose-tint {
          color: var(--past-ember);
        }
        .my-list {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .my-row {
          display: grid;
          grid-template-columns: 96px 1fr;
          gap: 0.55rem;
          align-items: baseline;
          padding: 0.45rem 0.55rem;
          border-radius: 10px;
          border: 1px solid transparent;
          text-align: left;
          font-size: 0.8rem;
        }
        .my-row:hover {
          border-color: var(--mist);
          background: rgba(232, 240, 255, 0.03);
          background: color(display-p3 0.91 0.941 1 / 0.03);
        }
        .my-row-date {
          font-size: 0.62rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }
        .my-row-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
