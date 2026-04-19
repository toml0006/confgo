import { useEffect, useState } from "react";
import {
  getConferenceAttendees,
  markAttendance,
  sendPing,
  unmarkAttendance,
  ApiError,
} from "../lib/api";
import { formatDateRange, relativeLabel } from "../lib/dates";
import type { Attendee, Conference, PingIndicator } from "../lib/types";
import { UserAvatar } from "./UserAvatar";
import { ArrowLeftIcon, CloseIcon, ExternalIcon } from "./icons";

interface Props {
  conference: Conference;
  myIntent: "been" | "going" | null;
  selfUserId: string | null;
  onBack: () => void;
  onClose: () => void;
  onAttendanceChange: () => void;
  onOpenPeer: (userId: string) => void;
  onShowBackButton: boolean;
}

export function ConferenceSheet({
  conference,
  myIntent,
  selfUserId,
  onBack,
  onClose,
  onAttendanceChange,
  onOpenPeer,
  onShowBackButton,
}: Props) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [pingError, setPingError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getConferenceAttendees(conference.id)
      .then(({ attendees }) => {
        if (!cancelled) setAttendees(attendees);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conference.id]);

  const now = Date.now();
  const isPast = Date.parse(conference.endDate) < now;

  async function handleMark(intent: "been" | "going") {
    setBusy(true);
    try {
      await markAttendance(conference.id, intent);
      onAttendanceChange();
    } finally {
      setBusy(false);
    }
  }
  async function handleUnmark() {
    setBusy(true);
    try {
      await unmarkAttendance(conference.id);
      onAttendanceChange();
    } finally {
      setBusy(false);
    }
  }

  async function handlePing(userId: string) {
    setPingError(null);
    try {
      await sendPing(userId);
      const { attendees } = await getConferenceAttendees(conference.id);
      setAttendees(attendees);
    } catch (err) {
      if (err instanceof ApiError) setPingError(err.message);
      else setPingError("Could not send ping.");
    }
  }

  return (
    <section className="sheet glass" role="region" aria-label={conference.name}>
      <header className="sheet-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          {onShowBackButton && (
            <button className="back-btn" onClick={onBack}>
              <ArrowLeftIcon /> Back
            </button>
          )}
          <h2 className="sheet-title">{conference.name}</h2>
          <p className="sheet-subtitle">
            {conference.locationName} · {formatDateRange(conference.startDate, conference.endDate)}{" "}
            · <em>{relativeLabel(conference.startDate, conference.endDate, now)}</em>
          </p>
        </div>
        <button className="close-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </header>

      <div className="sheet-body">
        {conference.topics && conference.topics.length > 0 && (
          <div className="chip-row" aria-label="Topics">
            {conference.topics.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
        )}

        {conference.url && (
          <a
            className="external-link"
            href={conference.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit website <ExternalIcon />
          </a>
        )}

        <div className="sheet-divider" />

        <div className="button-row">
          {myIntent === null && !isPast && (
            <button
              className="soft-button primary"
              onClick={() => handleMark("going")}
              disabled={busy}
            >
              I'll be there
            </button>
          )}
          {myIntent === null && isPast && (
            <button
              className="soft-button primary"
              onClick={() => handleMark("been")}
              disabled={busy}
            >
              I was there
            </button>
          )}
          {myIntent && (
            <>
              <span
                style={{
                  fontSize: "0.72rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--signal)",
                  padding: "10px 0",
                }}
              >
                {myIntent === "going" ? "Going" : "Attended"}
              </span>
              <button
                className="soft-button quiet"
                onClick={handleUnmark}
                disabled={busy}
              >
                Unmark
              </button>
            </>
          )}
        </div>

        <div className="sheet-divider" />

        <div
          style={{
            fontSize: "0.68rem",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "var(--text-muted)",
            marginBottom: 12,
          }}
        >
          {loading ? "…" : `${attendees.length} ${attendees.length === 1 ? "attendee" : "attendees"}`}
        </div>

        {pingError && <p className="form-error" role="alert">{pingError}</p>}

        <div className="attendee-grid">
          {attendees.map((a) => {
            const isSelf = a.id === selfUserId;
            const indicator: PingIndicator = a.hasPingedYou && a.youPinged
              ? "mutual"
              : a.hasPingedYou
              ? "incoming"
              : a.youPinged
              ? "outgoing"
              : null;
            return (
              <div key={a.id} className="attendee-card">
                <button
                  onClick={() => onOpenPeer(a.id)}
                  aria-label={a.displayName || "Unnamed"}
                  style={{ borderRadius: "50%" }}
                >
                  <UserAvatar
                    avatarId={a.avatarId}
                    photoURL={a.photoURL}
                    displayName={a.displayName}
                    size={52}
                    pingIndicator={indicator}
                  />
                </button>
                <span className="name">{a.displayName || "Unnamed"}</span>
                {!isSelf && !a.youPinged && (
                  <button
                    className="ping-btn"
                    onClick={() => handlePing(a.id)}
                    disabled={a.youPinged}
                  >
                    ping
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
