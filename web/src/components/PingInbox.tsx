import { pingIntensity } from "@shared/domain";
import type { IncomingPing, MutualContact, OutgoingPing } from "@shared/domain";

import { UserAvatar } from "./UserAvatar";

type Props = {
  incoming: IncomingPing[];
  outgoing: OutgoingPing[];
  contacts: MutualContact[];
  canRespond: boolean;
  onClose: () => void;
  onPingBack: (pingId: string) => void;
  onReject: (pingId: string) => void;
  onRevoke: (pingId: string) => void;
  onDematch: (peerId: string) => void;
};

export function PingInbox({
  incoming,
  outgoing,
  contacts,
  canRespond,
  onClose,
  onPingBack,
  onReject,
  onRevoke,
  onDematch
}: Props) {
  return (
    <aside className="sheet sheet-right">
      <div className="sheet-header">
        <div className="sheet-kicker">Signals</div>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="sheet-body">
        <div className="section-heading"><span>Matched</span><span>{contacts.length}</span></div>
        {contacts.map((contact) => (
          <div key={contact.user.id} className="signal-row">
            <div className="signal-person">
              <UserAvatar avatarId={contact.user.avatarId} photoURL={contact.user.photoURL} displayName={contact.user.displayName} pingIndicator="mutual" />
              <div>
                <div>{contact.user.displayName?.trim() || "Unnamed"}</div>
                <div className="muted-copy">Matched</div>
              </div>
            </div>
            <button className="soft-button danger" onClick={() => onDematch(contact.user.id)}>Unmatch</button>
          </div>
        ))}

        <div className="section-heading"><span>Incoming</span><span>{incoming.length}</span></div>
        {incoming.map((ping) => (
          <div key={ping.pingId} className="signal-row">
            <div className="signal-person">
              <UserAvatar avatarId={ping.user.avatarId} photoURL={ping.user.photoURL} displayName={ping.user.displayName} pingIndicator="incoming" />
              <div>
                <div>{ping.user.displayName?.trim() || "Unnamed"}</div>
                <div className="muted-copy">{Math.round(pingIntensity(ping.createdAt) * 100)}% signal</div>
              </div>
            </div>
            {canRespond ? (
              <div className="inline-actions">
                <button className="soft-button primary" onClick={() => onPingBack(ping.pingId)}>Ping back</button>
                <button className="soft-button quiet" onClick={() => onReject(ping.pingId)}>Reject</button>
              </div>
            ) : (
              <div className="muted-copy">Create an account to respond</div>
            )}
          </div>
        ))}

        <div className="section-heading"><span>Sent</span><span>{outgoing.length}</span></div>
        {outgoing.map((ping) => (
          <div key={ping.pingId} className="signal-row">
            <div className="signal-person">
              <UserAvatar avatarId={ping.user.avatarId} photoURL={ping.user.photoURL} displayName={ping.user.displayName} pingIndicator="outgoing" />
              <div>
                <div>{ping.user.displayName?.trim() || "Unnamed"}</div>
                <div className="muted-copy">{Math.round(pingIntensity(ping.createdAt) * 100)}% signal</div>
              </div>
            </div>
            <button className="soft-button quiet" onClick={() => onRevoke(ping.pingId)}>Revoke</button>
          </div>
        ))}

        <p className="sheet-note">Mutual pings confirm connections. Pings fade after 30 days.</p>
      </div>
    </aside>
  );
}

