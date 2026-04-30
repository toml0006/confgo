import { useEffect, useState } from "react";
import {
  apiFetch,
  type AttendanceIntent,
  type Attendee,
  type Conference,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import type { ContactEntry } from "../lib/contacts";
import { PingComposer } from "./PingComposer";
import { PremiumCard } from "./PremiumCard";
import { UserAvatar } from "./UserAvatar";

type Props = {
  conference: Conference;
  myIntent: AttendanceIntent | undefined;
  onBack?: () => void;
  onClose: () => void;
  onMarked: () => void;
  onOpenPeer: (userId: string) => void;
};

export function ConferenceSheet({
  conference,
  myIntent,
  onBack,
  onClose,
  onMarked,
  onOpenPeer,
}: Props) {
  const { isAnonymous } = useAuth();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [busy, setBusy] = useState(false);
  const [composerFor, setComposerFor] = useState<Attendee | null>(null);

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

  async function handlePingSubmit(contacts: ContactEntry[]) {
    if (!composerFor) return;
    await apiFetch(`/users/${composerFor.userId}/ping`, {
      method: "POST",
      body: JSON.stringify({ contacts }),
    });
    setComposerFor(null);
    await loadAttendees();
  }

  const now = new Date();
  const isPast = new Date(conference.endDate) < now;
  const defaultAction: AttendanceIntent = isPast ? "been" : "going";

  return (
    <div
      className={`conf-sheet glass-panel sheet-in${conference.premium ? " conf-sheet--premium" : ""}`}
    >
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

      {conference.premium ? (
        <PremiumCard conference={conference} />
      ) : (
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
        </div>
      )}
      {(() => {
        // Prefer the curated taxonomy tags; fall back to source topics for
        // confs that pre-date the tagging pass.
        const list = conference.tags && conference.tags.length > 0
          ? conference.tags
          : conference.topics;
        if (list.length === 0) return null;
        return (
          <div className="topics">
            {list.map((t) => (
              <span key={t} className="topic-chip">
                {t}
              </span>
            ))}
          </div>
        );
      })()}

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
              <button
                type="button"
                className="attendee-identity"
                disabled={a.isYou}
                onClick={() => !a.isYou && onOpenPeer(a.userId)}
              >
                <UserAvatar
                  avatarId={a.avatarId}
                  photoURL={a.photoURL}
                  displayName={a.displayName}
                  size="md"
                  pingIndicator={
                    a.isYou
                      ? "none"
                      : a.youPinged && a.hasPingedYou
                        ? "mutual"
                        : a.hasPingedYou
                          ? "incoming"
                          : a.youPinged
                            ? "outgoing"
                            : "none"
                  }
                />
                <div className="attendee-meta">
                  <div className="attendee-name">
                    {a.isYou ? "You" : a.displayName ?? "Unnamed"}
                  </div>
                  <div className="attendee-intent muted">{a.intent}</div>
                </div>
              </button>
              <AttendeePing
                attendee={a}
                isAnonymous={isAnonymous}
                onPing={() => setComposerFor(a)}
              />
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

      {composerFor ? (
        <PingComposer
          title={`Ping ${composerFor.displayName ?? "Unnamed"}`}
          peerDisplayName={composerFor.displayName ?? "them"}
          submitLabel={composerFor.hasPingedYou ? "Ping back" : "Send ping"}
          onSubmit={handlePingSubmit}
          onCancel={() => setComposerFor(null)}
        />
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
        .conf-sheet--premium {
          border-color: var(--aurora-dim);
          box-shadow:
            0 10px 40px -15px rgba(0, 0, 0, 0.9),
            0 0 0 1px var(--aurora-dim) inset,
            0 0 60px -20px var(--aurora-dim);
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
          gap: 0.4rem;
          padding: 0.4rem 0.55rem;
          border: 1px solid var(--mist);
          border-radius: 12px;
        }
        .attendee-identity {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          flex: 1;
          min-width: 0;
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          color: inherit;
          text-align: left;
        }
        .attendee-identity:disabled {
          cursor: default;
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
        .attendee-ping-slot {
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }
        .attendee-ping-btn {
          font-size: 0.65rem;
          padding: 0.25rem 0.55rem;
          border-radius: 999px;
          background: transparent;
          border: 1px solid var(--mist, rgba(255,255,255,0.1));
          color: var(--text-muted, rgba(255,255,255,0.7));
          cursor: pointer;
          white-space: nowrap;
        }
        .attendee-ping-btn:hover:not(:disabled) {
          border-color: var(--signal, #5ee7d9);
          color: var(--signal, #5ee7d9);
        }
        .attendee-ping-btn:disabled { cursor: default; opacity: 0.55; }
        .attendee-ping-btn.primary {
          border-color: var(--signal, #5ee7d9);
          color: var(--signal, #5ee7d9);
        }
        .attendee-chip {
          font-size: 0.58rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          white-space: nowrap;
        }
        .attendee-chip.matched {
          background: rgba(94, 231, 217, 0.12);
          color: var(--signal, #5ee7d9);
          border: 1px solid rgba(94, 231, 217, 0.35);
        }
        .attendee-chip.sent {
          color: var(--text-muted, rgba(255, 255, 255, 0.5));
          border: 1px solid var(--mist, rgba(255, 255, 255, 0.08));
        }
      `}</style>
    </div>
  );
}

function AttendeePing({
  attendee,
  isAnonymous,
  onPing,
}: {
  attendee: Attendee;
  isAnonymous: boolean;
  onPing: () => void;
}) {
  if (attendee.isYou) return null;
  const mutual = attendee.youPinged && attendee.hasPingedYou;
  const sent = attendee.youPinged && !attendee.hasPingedYou;
  const incoming = !attendee.youPinged && attendee.hasPingedYou;
  return (
    <div className="attendee-ping-slot">
      {mutual ? (
        <span className="attendee-chip matched" aria-label="Matched">
          ✓ Matched
        </span>
      ) : sent ? (
        <span className="attendee-chip sent" aria-label="Pinged">
          Pinged
        </span>
      ) : (
        <button
          type="button"
          className={`attendee-ping-btn ${incoming ? "primary" : ""}`}
          disabled={isAnonymous}
          title={isAnonymous ? "Sign in to ping" : undefined}
          onClick={onPing}
        >
          {incoming ? "Ping back" : "Ping"}
        </button>
      )}
    </div>
  );
}
