import { useEffect, useState } from "react";
import {
  apiFetch,
  type AttendanceIntent,
  type Attendee,
  type Conference,
} from "../api";
import { UserAvatar } from "./UserAvatar";

type Props = {
  conference: Conference;
  myIntent: AttendanceIntent | undefined;
  onBack?: () => void;
  onClose: () => void;
  onMarked: () => void;
};

export function ConferenceSheet({
  conference,
  myIntent,
  onBack,
  onClose,
  onMarked,
}: Props) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadAttendees() {
    try {
      const data = await apiFetch<{ attendees: Attendee[] }>(
        `/conferences/${conference.id}/attendees`,
      );
      setAttendees(data.attendees);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadAttendees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conference.id]);

  async function mark(intent: AttendanceIntent) {
    setBusy(true);
    try {
      await apiFetch(`/conferences/${conference.id}/attend`, {
        method: "POST",
        body: JSON.stringify({ intent }),
      });
      onMarked();
      await loadAttendees();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function unmark() {
    setBusy(true);
    try {
      await apiFetch(`/conferences/${conference.id}/attend`, { method: "DELETE" });
      onMarked();
      await loadAttendees();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  const now = new Date();
  const isPast = new Date(conference.endDate) < now;
  const defaultAction: AttendanceIntent = isPast ? "been" : "going";

  return (
    <div className="conf-sheet glass-panel sheet-in">
      {onBack ? (
        <button
          className="soft-button soft-button--quiet conf-sheet-back"
          onClick={onBack}
        >
          ← Back
        </button>
      ) : null}
      <button
        className="close-x conf-sheet-close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>

      <div className="stack-sm">
        <div className="section-label">{conference.source ?? "conference"}</div>
        <h2 className="conf-name">{conference.name}</h2>
        <div className="muted">
          {conference.locationName} ·{" "}
          {new Date(conference.startDate).toLocaleDateString()}
          {conference.endDate && conference.endDate !== conference.startDate
            ? ` – ${new Date(conference.endDate).toLocaleDateString()}`
            : ""}
        </div>
        {conference.topics.length > 0 ? (
          <div className="topics">
            {conference.topics.map((t) => (
              <span key={t} className="topic-chip">
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="conf-actions">
        {myIntent === undefined ? (
          <>
            {!isPast && (
              <button
                className="soft-button soft-button--primary"
                disabled={busy}
                onClick={() => mark("going")}
              >
                I'll be there
              </button>
            )}
            <button
              className="soft-button"
              disabled={busy}
              onClick={() => mark("been")}
            >
              I was there
            </button>
          </>
        ) : (
          <>
            <div className="muted mine-tag">
              Marked as <strong>{myIntent === "going" ? "going" : "been"}</strong>
            </div>
            <button
              className="soft-button soft-button--danger"
              disabled={busy}
              onClick={unmark}
            >
              Unmark
            </button>
            {myIntent !== defaultAction ? (
              <button
                className="soft-button soft-button--quiet"
                disabled={busy}
                onClick={() => mark(defaultAction)}
              >
                Switch to "{defaultAction}"
              </button>
            ) : null}
          </>
        )}
      </div>

      <div className="section-label">Attendees ({attendees.length})</div>
      {attendees.length === 0 ? (
        <div className="caption">No one's marked this yet.</div>
      ) : (
        <div className="attendee-grid">
          {attendees.map((a) => (
            <div key={a.userId} className="attendee-tile" title={a.displayName ?? ""}>
              <UserAvatar
                avatarId={a.avatarId}
                photoURL={a.photoURL}
                displayName={a.displayName}
                size="md"
              />
              <div className="attendee-meta">
                <div className="attendee-name">
                  {a.isYou ? "You" : a.displayName ?? "Unnamed"}
                </div>
                <div className="attendee-intent muted">{a.intent}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {conference.url ? (
        <a
          className="soft-button soft-button--quiet"
          href={conference.url}
          target="_blank"
          rel="noreferrer"
        >
          Visit site ↗
        </a>
      ) : null}

      <style>{`
        .conf-sheet {
          position: fixed;
          top: 68px;
          left: 18px;
          width: min(420px, calc(100vw - 36px));
          max-height: calc(100vh - 86px);
          overflow-y: auto;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          z-index: 40;
        }
        .conf-sheet-close {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 2;
        }
        .conf-sheet-back {
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 2;
        }
        .conf-name {
          margin: 0;
          font-size: 1.3rem;
          font-weight: 400;
          line-height: 1.2;
        }
        .topics {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .topic-chip {
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          padding: 0.2rem 0.55rem;
          border: 1px solid var(--mist);
          border-radius: 999px;
          color: var(--text-muted);
        }
        .conf-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          align-items: center;
        }
        .mine-tag strong {
          color: var(--signal);
          font-weight: 400;
        }
        .attendee-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 0.6rem;
        }
        .attendee-tile {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.4rem 0.55rem;
          border: 1px solid var(--mist);
          border-radius: 12px;
        }
        .attendee-meta {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .attendee-name {
          font-size: 0.78rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .attendee-intent {
          font-size: 0.62rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }
      `}</style>
    </div>
  );
}
