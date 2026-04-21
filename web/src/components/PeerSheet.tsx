import { formatConferenceRange } from "@shared/domain";
import type { ConferenceRecord, PingIndicator } from "@shared/domain";

import { UserAvatar } from "./UserAvatar";

type Props = {
  peer: {
    id: string;
    avatarId: number;
    displayName: string | null;
    photoURL: string | null;
  } | null;
  sharedConferences: ConferenceRecord[];
  pingIndicator: PingIndicator;
  canPing: boolean;
  onPing: () => void;
  onClose: () => void;
  onBack?: () => void;
  onOpenConference: (conferenceId: string) => void;
};

export function PeerSheet({ peer, sharedConferences, pingIndicator, canPing, onPing, onClose, onBack, onOpenConference }: Props) {
  if (!peer) {
    return null;
  }

  return (
    <aside className="sheet sheet-left">
      <div className="sheet-header">
        {onBack ? <button className="back-button" onClick={onBack}>Back</button> : <span />}
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="sheet-body">
        <div className="peer-head">
          <UserAvatar
            avatarId={peer.avatarId}
            photoURL={peer.photoURL}
            displayName={peer.displayName}
            pingIndicator={pingIndicator}
            size={72}
          />
          <div>
            <div className="sheet-kicker">Peer</div>
            <h2>{peer.displayName?.trim() || "Unnamed"}</h2>
            <p className="sheet-note">{sharedConferences.length} shared conferences</p>
          </div>
        </div>
        {canPing ? <button className="soft-button primary" onClick={onPing}>Send ping</button> : null}
        <div className="section-heading">
          <span>Shared</span>
          <span>{sharedConferences.length}</span>
        </div>
        <div className="location-list">
          {sharedConferences.map((conference) => (
            <button key={conference.id} className="location-card" onClick={() => onOpenConference(conference.id)}>
              <span>{conference.name}</span>
              <span>{conference.locationName}</span>
              <span>{formatConferenceRange(conference.startDate, conference.endDate)}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

