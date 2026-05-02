import { useEffect, useMemo, useState } from "react";
import {
  apiFetch,
  type AttendanceIntent,
  type Conference,
  type PublicUser,
} from "../api";
import { isPast } from "../lib/decay";
import { Caption, FloatingPanel } from "@/components/ui/floating-panel";
import { Kicker } from "@/components/ui/kicker";
import { UserAvatar } from "./UserAvatar";

type Props = {
  user: PublicUser;
  conferences: Conference[];
  onBack?: () => void;
  onClose: () => void;
  onPickConference: (conf: Conference) => void;
};

type AttendanceRow = { conferenceId: string; intent: AttendanceIntent };

export function UserSheet({ user, conferences, onBack, onClose, onPickConference }: Props) {
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
    const now = new Date();
    const going: Conference[] = [];
    const been: Conference[] = [];
    // Bucket by temporal context, not stored intent — past events read
    // as "Been" and future as "Going" regardless of how the user
    // originally marked them.
    for (const a of attendances) {
      const conf = byId.get(a.conferenceId);
      if (!conf) continue;
      if (isPast(conf.endDate, now)) been.push(conf);
      else going.push(conf);
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
    <FloatingPanel side="top-left" onBack={onBack} onClose={onClose}>
      <div className="flex items-center gap-3.5">
        <UserAvatar
          avatarId={user.avatarId}
          photoURL={user.photoURL}
          displayName={user.displayName}
          size="xl"
        />
        <div className="flex flex-col gap-1">
          <Kicker>person</Kicker>
          <h2 className="m-0 font-display font-normal text-[1.6rem] leading-[1.05] tracking-[-0.025em] text-ink">
            {user.displayName ?? "Unnamed"}
          </h2>
        </div>
      </div>

      {loading ? (
        <Caption>Loading conferences…</Caption>
      ) : empty ? (
        <Caption>No conference activity yet.</Caption>
      ) : (
        <>
          {going.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Kicker tone="future">Going · {going.length}</Kicker>
              <ConferenceList confs={going} onPick={onPickConference} />
            </div>
          ) : null}
          {been.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Kicker tone="past">Been · {been.length}</Kicker>
              <ConferenceList confs={been} onPick={onPickConference} />
            </div>
          ) : null}
        </>
      )}
    </FloatingPanel>
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
    <div className="flex flex-col gap-1.5">
      {confs.map((c) => (
        <button
          key={c.id}
          onClick={() => onPick(c)}
          className="flex flex-col items-start gap-1 px-3 py-2 w-full text-left bg-bg border border-hair rounded-[10px] hover:border-ink3 transition-colors"
        >
          <span className="font-display text-[15px] font-medium text-ink">
            {c.name}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink3">
            {c.locationName} · {new Date(c.startDate).toLocaleDateString()}
          </span>
        </button>
      ))}
    </div>
  );
}
