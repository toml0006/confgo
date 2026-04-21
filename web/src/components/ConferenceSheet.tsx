import { formatConferenceRange, isPastConference } from "@shared/domain";
import type { AttendanceIntent, AttendeeSummary, ConferenceRecord } from "@shared/domain";

import { UserAvatar } from "./UserAvatar";

type Props = {
  conference: ConferenceRecord;
  attendees: AttendeeSummary[];
  attendanceIntent: AttendanceIntent | undefined;
  anonymous: boolean;
  onClose: () => void;
  onBack?: () => void;
  onAttend: (intent: AttendanceIntent) => void;
  onUnmark: () => void;
  onOpenPeer: (userId: string) => void;
  onPing: (userId: string) => void;
};

export function ConferenceSheet({
  conference,
  attendees,
  attendanceIntent,
  anonymous,
  onClose,
  onBack,
  onAttend,
  onUnmark,
  onOpenPeer,
  onPing
}: Props) {
  const past = isPastConference(conference.endDate);

  return (
    <aside className="sheet sheet-left">
      <div className="sheet-header">
        {onBack ? <button className="back-button" onClick={onBack}>Back</button> : <span />}
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="sheet-body">
        <div className="sheet-kicker">Conference</div>
        <h2>{conference.name}</h2>
        <p className="sheet-subtitle">{conference.locationName}</p>
        <p className="sheet-note">{formatConferenceRange(conference.startDate, conference.endDate)}</p>
        {conference.url ? <a className="inline-link" href={conference.url} target="_blank" rel="noreferrer">Visit conference site</a> : null}

        <div className="action-row">
          <button className={`soft-button ${attendanceIntent === "going" ? "primary" : ""}`} onClick={() => onAttend("going")}>
            I&apos;ll be there
          </button>
          <button className={`soft-button ${attendanceIntent === "been" ? "rose" : ""}`} onClick={() => onAttend("been")}>
            I was there
          </button>
          {attendanceIntent ? <button className="soft-button quiet" onClick={onUnmark}>Unmark</button> : null}
        </div>

        <div className="section-heading">
          <span>Attendees</span>
          <span>{attendees.length}</span>
        </div>
        <div className="attendee-grid">
          {attendees.map((attendee) => {
            const pingIndicator = attendee.hasPingedYou
              ? "incoming"
              : (attendee.youPinged ? "outgoing" : null);
            return (
              <button
                key={attendee.id}
                className="attendee-card"
                onClick={() => onOpenPeer(attendee.id)}
              >
                <UserAvatar
                  avatarId={attendee.avatarId}
                  photoURL={attendee.photoURL}
                  displayName={attendee.displayName}
                  pingIndicator={pingIndicator}
                />
                <span>{attendee.displayName?.trim() || "Unnamed"}</span>
                {!anonymous ? (
                  <span
                    className="mini-signal"
                    onClick={(event) => {
                      event.stopPropagation();
                      onPing(attendee.id);
                    }}
                  >
                    ping
                  </span>
                ) : null}
              </button>
            );
          })}
          {!attendees.length ? <div className="empty-copy">{past ? "No one marked this conference yet." : "Be the first to mark this conference."}</div> : null}
        </div>
      </div>
    </aside>
  );
}

