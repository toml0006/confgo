interface Props {
  conferenceCount: number;
  peerCount: number;
  selectedInfo?: { conferenceCount: number; coAttendeeCount: number } | null;
}

export function CoAttendanceToast({ conferenceCount, peerCount, selectedInfo }: Props) {
  return (
    <div className="toast glass" role="status">
      <div>
        Co-attendance: {conferenceCount}{" "}
        {conferenceCount === 1 ? "conference" : "conferences"}, {peerCount}{" "}
        {peerCount === 1 ? "co-attendee" : "co-attendees"}
      </div>
      {selectedInfo && (
        <div className="line2">
          Selected: {selectedInfo.conferenceCount}{" "}
          {selectedInfo.conferenceCount === 1 ? "conference" : "conferences"},{" "}
          {selectedInfo.coAttendeeCount}{" "}
          {selectedInfo.coAttendeeCount === 1 ? "co-attendee" : "co-attendees"}
        </div>
      )}
    </div>
  );
}
