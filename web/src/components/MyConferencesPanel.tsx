import { formatConferenceRange, isPastConference } from "@shared/domain";
import type { AttendanceIntent, ConferenceRecord } from "@shared/domain";

type Props = {
  conferences: ConferenceRecord[];
  attendances: Map<string, AttendanceIntent>;
  onClose: () => void;
  onOpenConference: (conferenceId: string) => void;
};

export function MyConferencesPanel({ conferences, attendances, onClose, onOpenConference }: Props) {
  const marked = conferences.filter((conference) => attendances.has(conference.id));
  const going = marked
    .filter((conference) => attendances.get(conference.id) === "going")
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const been = marked
    .filter((conference) => attendances.get(conference.id) === "been" || isPastConference(conference.endDate))
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return (
    <aside className="sheet sheet-right">
      <div className="sheet-header">
        <div className="sheet-kicker">My Conferences</div>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="sheet-body">
        <div className="section-heading teal"><span>Going</span><span>{going.length}</span></div>
        {going.map((conference) => (
          <button key={conference.id} className="location-card" onClick={() => onOpenConference(conference.id)}>
            <span>{conference.name}</span>
            <span>{conference.locationName}</span>
            <span>{formatConferenceRange(conference.startDate, conference.endDate)}</span>
          </button>
        ))}
        {!going.length ? <div className="empty-copy">Nothing upcoming yet.</div> : null}

        <div className="section-heading rose"><span>Been</span><span>{been.length}</span></div>
        {been.map((conference) => (
          <button key={conference.id} className="location-card past" onClick={() => onOpenConference(conference.id)}>
            <span>{conference.name}</span>
            <span>{conference.locationName}</span>
            <span>{formatConferenceRange(conference.startDate, conference.endDate)}</span>
          </button>
        ))}
        {!been.length ? <div className="empty-copy">No conference history yet.</div> : null}
      </div>
    </aside>
  );
}

