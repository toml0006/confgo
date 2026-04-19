import { useCallback, useEffect, useState } from "react";
import {
  dematch,
  getIncomingPings,
  getMutualContacts,
  getOutgoingPings,
  pingBack,
  rejectPing,
  revokePing,
} from "../lib/api";
import type { IncomingPing, MutualContact, OutgoingPing } from "../lib/types";
import { UserAvatar } from "./UserAvatar";
import { CloseIcon } from "./icons";
import { usePingUpdates } from "../hooks/usePingUpdates";

interface Props {
  selfId: string | null;
  isLinked: boolean;
  onClose: () => void;
  onOpenPeer: (userId: string) => void;
}

export function PingInbox({ selfId, isLinked, onClose, onOpenPeer }: Props) {
  const [incoming, setIncoming] = useState<IncomingPing[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingPing[]>([]);
  const [mutual, setMutual] = useState<MutualContact[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [{ incoming }, { outgoing }, { contacts }] = await Promise.all([
      getIncomingPings(),
      getOutgoingPings(),
      getMutualContacts(),
    ]);
    setIncoming(incoming);
    setOutgoing(outgoing);
    setMutual(contacts);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);
  usePingUpdates(selfId, reload);

  const mutualSet = new Set(mutual.map((m) => m.id));
  const incomingFiltered = incoming.filter((p) => !mutualSet.has(p.from.id));
  const outgoingFiltered = outgoing.filter((p) => !mutualSet.has(p.to.id));

  return (
    <section className="sheet right glass" role="region" aria-label="Signals">
      <header className="sheet-header">
        <div>
          <h2 className="sheet-title">Signals</h2>
          <p className="sheet-subtitle">
            Mutual pings confirm connections. Pings fade after 30 days.
          </p>
        </div>
        <button className="close-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </header>
      <div className="sheet-body">
        {loading ? (
          <p className="sheet-subtitle">Loading…</p>
        ) : (
          <>
            <Section title="Matched">
              {mutual.length === 0 && <Empty>No matches yet.</Empty>}
              {mutual.map((m) => (
                <div key={m.id} className="list-item" style={{ alignItems: "center" }}>
                  <button
                    onClick={() => onOpenPeer(m.id)}
                    aria-label={m.displayName || "Unnamed"}
                    style={{ borderRadius: "50%" }}
                  >
                    <UserAvatar
                      avatarId={m.avatarId}
                      photoURL={m.photoURL}
                      displayName={m.displayName}
                      pingIndicator="mutual"
                      size={40}
                    />
                  </button>
                  <div className="meta">
                    <span className="title">{m.displayName || "Unnamed"}</span>
                    <span className="sub">Matched</span>
                  </div>
                  {isLinked && (
                    <button
                      className="soft-button danger"
                      style={{ fontSize: "0.6rem", padding: "6px 10px" }}
                      onClick={async () => {
                        await dematch(m.id);
                        await reload();
                      }}
                    >
                      Unmatch
                    </button>
                  )}
                </div>
              ))}
            </Section>

            <Section title="Incoming">
              {incomingFiltered.length === 0 && <Empty>No incoming pings.</Empty>}
              {incomingFiltered.map((p) => (
                <div key={p.id} className="list-item" style={{ alignItems: "center" }}>
                  <button
                    onClick={() => onOpenPeer(p.from.id)}
                    aria-label={p.from.displayName || "Unnamed"}
                    style={{ borderRadius: "50%" }}
                  >
                    <UserAvatar
                      avatarId={p.from.avatarId}
                      photoURL={p.from.photoURL}
                      displayName={p.from.displayName}
                      pingIndicator="incoming"
                      size={40}
                    />
                  </button>
                  <div className="meta">
                    <span className="title">{p.from.displayName || "Unnamed"}</span>
                    <span className="sub">
                      {isLinked ? "Sent you a ping" : "Create an account to respond"}
                    </span>
                  </div>
                  {isLinked && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="soft-button primary"
                        style={{ fontSize: "0.6rem", padding: "6px 10px" }}
                        onClick={async () => {
                          await pingBack(p.id);
                          await reload();
                        }}
                      >
                        Ping back
                      </button>
                      <button
                        className="soft-button quiet"
                        style={{ fontSize: "0.6rem", padding: "6px 10px" }}
                        onClick={async () => {
                          await rejectPing(p.id);
                          await reload();
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </Section>

            <Section title="Sent">
              {outgoingFiltered.length === 0 && <Empty>No sent pings.</Empty>}
              {outgoingFiltered.map((p) => (
                <div key={p.id} className="list-item" style={{ alignItems: "center" }}>
                  <button
                    onClick={() => onOpenPeer(p.to.id)}
                    aria-label={p.to.displayName || "Unnamed"}
                    style={{ borderRadius: "50%" }}
                  >
                    <UserAvatar
                      avatarId={p.to.avatarId}
                      photoURL={p.to.photoURL}
                      displayName={p.to.displayName}
                      pingIndicator="outgoing"
                      size={40}
                    />
                  </button>
                  <div className="meta">
                    <span className="title">{p.to.displayName || "Unnamed"}</span>
                    <span className="sub">Awaiting response</span>
                  </div>
                  {isLinked && (
                    <button
                      className="soft-button quiet"
                      style={{ fontSize: "0.6rem", padding: "6px 10px" }}
                      onClick={async () => {
                        await revokePing(p.id);
                        await reload();
                      }}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </Section>
          </>
        )}
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          fontSize: "0.64rem",
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          color: "var(--text-muted)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="sheet-subtitle" style={{ opacity: 0.55 }}>
      {children}
    </p>
  );
}
