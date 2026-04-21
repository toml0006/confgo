import { formatConferenceRange } from "@shared/domain";
import type { AttendanceIntent, ConferenceRecord } from "@shared/domain";

type Props = {
  locationName: string;
  conferences: ConferenceRecord[];
  attendances: Map<string, AttendanceIntent>;
  onClose: () => void;
  onBack?: () => void;
  onOpenConference: (conferenceId: string) => void;
};

export function LocationSheet({ locationName, conferences, attendances, onClose, onBack, onOpenConference }: Props) {
  const now = Date.now();
  const sorted = [...conferences].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return (
    <aside className="sheet sheet-left">
      <div className="sheet-header">
        {onBack ? <button className="back-button" onClick={onBack}>Back</button> : <span />}
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="sheet-body">
        <div className="sheet-kicker">Location</div>
        <h2>{locationName}</h2>
        <div className="section-heading">
          <span>Timeline</span>
          <span>{sorted.length}</span>
        </div>
        <div className="location-list">
          {sorted.map((conference, index) => {
            const conferenceTime = new Date(conference.startDate).getTime();
            const showNowDivider =
              index > 0 &&
              new Date(sorted[index - 1]!.startDate).getTime() < now &&
              conferenceTime >= now;
            return (
              <div key={conference.id}>
                {showNowDivider ? <div className="now-divider">NOW</div> : null}
                <button className={`location-card ${conferenceTime < now ? "past" : ""}`} onClick={() => onOpenConference(conference.id)}>
                  <span>{conference.name}</span>
                  <span>{formatConferenceRange(conference.startDate, conference.endDate)}</span>
                  <span>{attendances.get(conference.id) ? "Marked" : "Unmarked"}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

