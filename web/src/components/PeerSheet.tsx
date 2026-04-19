import { useEffect, useState } from "react";
import { getSharedMap, getUserProfile, sendPing, ApiError } from "../lib/api";
import type { Conference, UserSummary } from "../lib/types";
import { formatDateRange } from "../lib/dates";
import { UserAvatar } from "./UserAvatar";
import { ArrowLeftIcon, CloseIcon } from "./icons";

interface Props {
  userId: string;
  selfId: string | null;
  isLinked: boolean;
  onBack: () => void;
  onClose: () => void;
  onPickConference: (c: Conference) => void;
}

export function PeerSheet({
  userId,
  selfId,
  isLinked,
  onBack,
  onClose,
  onPickConference,
}: Props) {
  const [profile, setProfile] = useState<UserSummary | null>(null);
  const [shared, setShared] = useState<Conference[]>([]);
  const [alreadyPinged, setAlreadyPinged] = useState(false);
  const [pingErr, setPingErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await getUserProfile(userId);
        const { conferences } = await getSharedMap(userId);
        if (cancelled) return;
        setProfile(user);
        setShared(conferences);
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handlePing() {
    setPingErr(null);
    try {
      await sendPing(userId);
      setAlreadyPinged(true);
    } catch (err) {
      if (err instanceof ApiError) setPingErr(err.message);
      else setPingErr("Could not send ping.");
    }
  }

  const isSelf = selfId === userId;

  return (
    <section className="sheet glass" role="region" aria-label="Peer">
      <header className="sheet-header">
        <div style={{ flex: 1 }}>
          <button className="back-btn" onClick={onBack}>
            <ArrowLeftIcon /> Back
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
            {profile ? (
              <UserAvatar
                avatarId={profile.avatarId}
                photoURL={profile.photoURL}
                displayName={profile.displayName}
                size={52}
              />
            ) : (
              <div style={{ width: 52, height: 52 }} />
            )}
            <div>
              <h2 className="sheet-title">{profile?.displayName || "Unnamed"}</h2>
              <p className="sheet-subtitle">
                {shared.length} shared {shared.length === 1 ? "conference" : "conferences"}
              </p>
            </div>
          </div>
        </div>
        <button className="close-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </header>

      <div className="sheet-body">
        {!isSelf && isLinked && !alreadyPinged && (
          <div className="button-row" style={{ marginBottom: 14 }}>
            <button className="soft-button primary" onClick={handlePing}>
              Send ping
            </button>
          </div>
        )}
        {!isSelf && !isLinked && (
          <p className="sheet-subtitle" style={{ marginBottom: 14 }}>
            Create an account from Settings to send pings.
          </p>
        )}
        {alreadyPinged && (
          <p className="sheet-subtitle" style={{ color: "var(--signal)", marginBottom: 14 }}>
            Ping sent.
          </p>
        )}
        {pingErr && <p className="form-error">{pingErr}</p>}

        <div
          style={{
            fontSize: "0.68rem",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "var(--text-muted)",
            marginBottom: 8,
          }}
        >
          Shared conferences
        </div>

        {shared.length === 0 && (
          <p className="sheet-subtitle">No conferences in common yet.</p>
        )}
        {shared.map((c) => (
          <button key={c.id} className="list-item" onClick={() => onPickConference(c)}>
            <div className="meta">
              <span className="title">{c.name}</span>
              <span className="sub">
                {c.locationName} · {formatDateRange(c.startDate, c.endDate)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
