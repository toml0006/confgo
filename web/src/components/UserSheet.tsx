import { useEffect, useMemo, useState } from "react";
import {
  apiFetch,
  type AttendanceIntent,
  type Conference,
  type PublicUser,
} from "../api";
import { UserAvatar } from "./UserAvatar";

type Props = {
  user: PublicUser;
  conferences: Conference[];
  onClose: () => void;
  onPickConference: (conf: Conference) => void;
};

type AttendanceRow = { conferenceId: string; intent: AttendanceIntent };

export function UserSheet({ user, conferences, onClose, onPickConference }: Props) {
  const [attendances, setAttendances] = useState<AttendanceRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ attendances: AttendanceRow[] }>(`/users/${user.id}/attendances`)
      .then((data) => {
        if (!cancelled) setAttendances(data.attendances);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setAttendances([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const { going, been } = useMemo(() => {
    if (!attendances) return { going: [], been: [] };
    const byId = new Map(conferences.map((c) => [c.id, c]));
    const going: Conference[] = [];
    const been: Conference[] = [];
    for (const a of attendances) {
      const conf = byId.get(a.conferenceId);
      if (!conf) continue;
      (a.intent === "going" ? going : been).push(conf);
    }
    const byStartDesc = (a: Conference, b: Conference) =>
      b.startDate.localeCompare(a.startDate);
    going.sort(byStartDesc);
    been.sort(byStartDesc);
    return { going, been };
  }, [attendances, conferences]);

  const loading = attendances === null;
  const empty = !loading && going.length === 0 && been.length === 0;

  return (
    <div className="user-sheet glass-panel sheet-in">
      <button
        className="close-x user-sheet-close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>

      <div className="user-sheet-hero">
        <UserAvatar
          avatarId={user.avatarId}
          photoURL={user.photoURL}
          displayName={user.displayName}
          size="xl"
        />
        <div>
          <div className="section-label">person</div>
          <h2 className="user-name">{user.displayName ?? "Unnamed"}</h2>
        </div>
      </div>

      {loading ? (
        <div className="caption muted">Loading conferences…</div>
      ) : empty ? (
        <div className="caption muted">No conference activity yet.</div>
      ) : (
        <>
          {going.length > 0 ? (
            <div className="stack-sm">
              <div className="section-label">Going ({going.length})</div>
              <ConferenceList
                confs={going}
                onPick={onPickConference}
              />
            </div>
          ) : null}
          {been.length > 0 ? (
            <div className="stack-sm">
              <div className="section-label">Been ({been.length})</div>
              <ConferenceList
                confs={been}
                onPick={onPickConference}
              />
            </div>
          ) : null}
        </>
      )}

      <style>{`
        .user-sheet {
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
        .user-sheet-close {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 2;
        }
        .user-sheet-hero {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .user-name {
          margin: 0;
          font-size: 1.3rem;
          font-weight: 400;
          line-height: 1.2;
        }
        .user-conf-row {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          padding: 0.55rem 0.75rem;
          width: 100%;
          text-align: left;
          border: 1px solid var(--mist);
          border-radius: 12px;
          background: transparent;
          cursor: pointer;
        }
        .user-conf-row + .user-conf-row {
          margin-top: 6px;
        }
        .user-conf-row:hover {
          background: rgba(232, 240, 255, 0.04);
        }
        .user-conf-row .name {
          font-size: 0.85rem;
        }
        .user-conf-row .meta {
          font-size: 0.68rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }
      `}</style>
    </div>
  );
}

function ConferenceList({
  confs,
  onPick,
}: {
  confs: Conference[];
  onPick: (conf: Conference) => void;
}) {
  return (
    <div>
      {confs.map((c) => (
        <button
          key={c.id}
          className="user-conf-row"
          onClick={() => onPick(c)}
        >
          <span className="name">{c.name}</span>
          <span className="meta">
            {c.locationName} · {new Date(c.startDate).toLocaleDateString()}
          </span>
        </button>
      ))}
    </div>
  );
}
