import { useCallback, useEffect, useState } from "react";
import { apiFetch, type Conference, type UserProfile } from "../api";
import { useAuth } from "../auth/AuthContext";
import type { ContactEntry } from "../lib/contacts";
import { PingComposer } from "./PingComposer";
import { UserAvatar } from "./UserAvatar";

type Props = {
  userId: string;
  onBack?: () => void;
  onClose: () => void;
  onOpenConference: (conf: Conference) => void;
};

export function PeerSheet({ userId, onBack, onClose, onOpenConference }: Props) {
  const { isAnonymous } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<UserProfile>(`/users/${userId}/profile`);
      setProfile(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(contacts: ContactEntry[]) {
    setActionError(null);
    await apiFetch(`/users/${userId}/ping`, {
      method: "POST",
      body: JSON.stringify({ contacts }),
    });
    setComposerOpen(false);
    await load();
  }

  if (!profile) {
    return (
      <div className="peer-sheet glass-panel sheet-in">
        <div className="conf-sheet-head">
          {onBack ? (
            <button className="soft-button soft-button--quiet" onClick={onBack}>
              ← Back
            </button>
          ) : (
            <span />
          )}
          <button className="close-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="caption">{error ?? "Loading…"}</div>
        <PeerSheetStyles />
      </div>
    );
  }

  const { user, shared, pingState } = profile;
  const pingStatus = pingStatusOf(pingState);
  const displayName = user.displayName ?? "Unnamed";

  return (
    <>
      <div className="peer-sheet glass-panel sheet-in">
        <div className="conf-sheet-head">
          {onBack ? (
            <button className="soft-button soft-button--quiet" onClick={onBack}>
              ← Back
            </button>
          ) : (
            <span />
          )}
          <button className="close-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="peer-identity">
          <UserAvatar
            avatarId={user.avatarId}
            photoURL={user.photoURL}
            displayName={user.displayName}
            size="xl"
            pingIndicator={
              pingStatus === "matched"
                ? "mutual"
                : pingStatus === "incoming"
                  ? "incoming"
                  : pingStatus === "sent"
                    ? "outgoing"
                    : "none"
            }
          />
          <div>
            <div className="peer-name">{displayName}</div>
            <div className="caption">
              {shared.length === 0
                ? "No shared conferences."
                : `${shared.length} shared conference${shared.length === 1 ? "" : "s"}.`}
            </div>
          </div>
        </div>

        <div className="peer-ping">
          {pingStatus === "matched" ? (
            <div className="mini-chip matched">✓ Matched</div>
          ) : pingStatus === "sent" ? (
            <div className="mini-chip sent">• Pinged</div>
          ) : pingStatus === "incoming" ? (
            <button
              className="soft-button soft-button--primary"
              disabled={isAnonymous}
              title={isAnonymous ? "Sign in to respond" : undefined}
              onClick={() => setComposerOpen(true)}
            >
              Ping back
            </button>
          ) : pingStatus === "none" ? (
            <button
              className="soft-button soft-button--primary"
              disabled={isAnonymous}
              title={isAnonymous ? "Sign in to ping" : undefined}
              onClick={() => setComposerOpen(true)}
            >
              Send ping
            </button>
          ) : null}
        </div>

        {actionError ? <div className="auth-error">{actionError}</div> : null}

        {shared.length > 0 ? (
          <>
            <div className="section-label">Shared ({shared.length})</div>
            <div className="peer-shared-list">
              {shared.map((c) => (
                <button
                  key={c.id}
                  className="peer-shared-row"
                  onClick={() => onOpenConference(c)}
                >
                  <span className="peer-shared-date">
                    {new Date(c.startDate).toLocaleDateString()}
                  </span>
                  <span className="peer-shared-name">{c.name}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        <PeerSheetStyles />
      </div>

      {composerOpen ? (
        <PingComposer
          title={`Ping ${displayName}`}
          peerDisplayName={displayName}
          submitLabel={pingStatus === "incoming" ? "Ping back" : "Send ping"}
          onSubmit={handleSubmit}
          onCancel={() => setComposerOpen(false)}
        />
      ) : null}
    </>
  );
}

type PingStatus = "none" | "sent" | "incoming" | "matched" | "self";

function pingStatusOf(s: UserProfile["pingState"]): PingStatus {
  if (!s) return "self";
  if (s.youPinged && s.hasPingedYou) return "matched";
  if (s.youPinged) return "sent";
  if (s.hasPingedYou) return "incoming";
  return "none";
}

function PeerSheetStyles() {
  return (
    <style>{`
      .peer-sheet {
        position: fixed;
        top: 92px;
        left: 18px;
        width: min(420px, calc(100vw - 36px));
        max-height: calc(100vh - 110px);
        overflow-y: auto;
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        z-index: 40;
      }
      .peer-identity {
        display: flex;
        gap: 0.9rem;
        align-items: center;
      }
      .peer-name {
        font-size: 1.05rem;
        margin-bottom: 0.15rem;
      }
      .peer-ping {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
      .peer-shared-list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .peer-shared-row {
        display: flex;
        align-items: baseline;
        gap: 0.7rem;
        padding: 0.4rem 0.55rem;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 6px;
        border: 1px solid transparent;
        text-align: left;
        color: inherit;
        cursor: pointer;
      }
      .peer-shared-row:hover {
        border-color: var(--mist, rgba(255,255,255,0.08));
        background: rgba(255, 255, 255, 0.04);
      }
      .peer-shared-date {
        font-size: 0.65rem;
        color: var(--muted, rgba(255,255,255,0.5));
        text-transform: uppercase;
        letter-spacing: 0.1em;
        white-space: nowrap;
      }
      .peer-shared-name {
        flex: 1;
        min-width: 0;
        font-size: 0.85rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .mini-chip {
        display: inline-flex;
        align-items: center;
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .mini-chip.matched {
        background: rgba(94, 231, 217, 0.12);
        color: var(--signal, #5ee7d9);
        border: 1px solid rgba(94, 231, 217, 0.35);
      }
      .mini-chip.sent {
        background: rgba(255, 255, 255, 0.04);
        color: var(--text-muted, rgba(255, 255, 255, 0.6));
        border: 1px solid var(--mist, rgba(255, 255, 255, 0.08));
      }
    `}</style>
  );
}
