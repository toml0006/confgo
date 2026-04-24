import { useCallback, useEffect, useState } from "react";
import {
  apiFetch,
  type IncomingPing,
  type MutualContact,
  type OutgoingPing,
  type UserSummary,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { CONTACT_LABELS, contactHref, type ContactEntry } from "../lib/contacts";
import { PingComposer } from "./PingComposer";
import { UserAvatar } from "./UserAvatar";

type Tab = "matched" | "incoming" | "sent";

type Props = {
  onClose: () => void;
};

function timeAgo(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function ContactLinks({ contacts }: { contacts: ContactEntry[] }) {
  if (contacts.length === 0) return <span className="caption">(none)</span>;
  return (
    <div className="contact-links">
      {contacts.map((c, idx) => {
        const href = contactHref(c);
        const label = `${CONTACT_LABELS[c.type]}${c.label ? ` · ${c.label}` : ""}`;
        return (
          <span key={idx} className="contact-link-row">
            <span className="contact-type">{label}</span>
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="contact-value link">
                {c.value}
              </a>
            ) : (
              <span className="contact-value">{c.value}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export function PingInbox({ onClose }: Props) {
  const { isAnonymous } = useAuth();
  const [tab, setTab] = useState<Tab>("matched");
  const [matched, setMatched] = useState<MutualContact[] | null>(null);
  const [incoming, setIncoming] = useState<IncomingPing[] | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingPing[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [composer, setComposer] = useState<
    | { kind: "ping-back"; pingId: string; peer: UserSummary }
    | null
  >(null);

  const refresh = useCallback(async () => {
    setActionError(null);
    try {
      const [m, i, o] = await Promise.all([
        apiFetch<{ contacts: MutualContact[] }>("/pings/mutual-contacts"),
        apiFetch<{ incoming: IncomingPing[] }>("/pings/incoming"),
        apiFetch<{ outgoing: OutgoingPing[] }>("/pings/outgoing"),
      ]);
      setMatched(m.contacts);
      setIncoming(i.incoming);
      setOutgoing(o.outgoing);
    } catch (err) {
      setActionError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleReject(pingId: string) {
    setActionError(null);
    try {
      await apiFetch(`/pings/${pingId}/reject`, { method: "POST" });
      await refresh();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function handleRevoke(pingId: string) {
    setActionError(null);
    try {
      await apiFetch(`/pings/${pingId}/revoke`, { method: "POST" });
      await refresh();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function handleDematch(peerId: string) {
    setActionError(null);
    try {
      await apiFetch(`/pings/dematch/${peerId}`, { method: "POST" });
      await refresh();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function handlePingBackSubmit(contacts: ContactEntry[]) {
    if (!composer) return;
    await apiFetch(`/pings/${composer.pingId}/ping-back`, {
      method: "POST",
      body: JSON.stringify({ contacts }),
    });
    setComposer(null);
    await refresh();
  }

  const matchedCount = matched?.length ?? 0;
  const incomingCount = incoming?.length ?? 0;
  const sentCount = outgoing?.length ?? 0;

  return (
    <>
      <div className="inbox glass-panel sheet-in">
        <div className="inbox-head">
          <h2 className="inbox-title">Signals</h2>
          <button className="close-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="inbox-tabs" role="tablist">
          <TabButton active={tab === "matched"} onClick={() => setTab("matched")} count={matchedCount}>
            Matched
          </TabButton>
          <TabButton active={tab === "incoming"} onClick={() => setTab("incoming")} count={incomingCount}>
            Incoming
          </TabButton>
          <TabButton active={tab === "sent"} onClick={() => setTab("sent")} count={sentCount}>
            Sent
          </TabButton>
        </div>

        {actionError ? <div className="auth-error">{actionError}</div> : null}

        {tab === "matched" ? (
          matched === null ? (
            <div className="caption">Loading…</div>
          ) : matched.length === 0 ? (
            <div className="caption">No matches yet.</div>
          ) : (
            <ul className="inbox-list">
              {matched.map((m) => (
                <li key={m.peer.id} className="inbox-row">
                  <div className="row-head">
                    <UserAvatar
                      avatarId={m.peer.avatarId}
                      photoURL={m.peer.photoURL}
                      displayName={m.peer.displayName}
                      size="sm"
                      pingIndicator="mutual"
                    />
                    <div className="row-identity">
                      <div className="row-name">{m.peer.displayName ?? "Unnamed"}</div>
                      <div className="caption">Matched {timeAgo(m.matchedAt)}</div>
                    </div>
                    <button
                      className="soft-button soft-button--quiet"
                      onClick={() => handleDematch(m.peer.id)}
                    >
                      Unmatch
                    </button>
                  </div>
                  <div className="disclosures">
                    <div className="section-label small-label">Theirs</div>
                    <ContactLinks contacts={m.theirContacts} />
                    <div className="section-label small-label">Yours</div>
                    <ContactLinks contacts={m.yourContacts} />
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {tab === "incoming" ? (
          incoming === null ? (
            <div className="caption">Loading…</div>
          ) : incoming.length === 0 ? (
            <div className="caption">No pings waiting.</div>
          ) : (
            <ul className="inbox-list">
              {incoming.map((p) => (
                <li key={p.pingId} className="inbox-row">
                  <div className="row-head">
                    <UserAvatar
                      avatarId={p.fromUser.avatarId}
                      photoURL={p.fromUser.photoURL}
                      displayName={p.fromUser.displayName}
                      size="sm"
                      pingIndicator="incoming"
                    />
                    <div className="row-identity">
                      <div className="row-name">{p.fromUser.displayName ?? "Unnamed"}</div>
                      <div className="caption">{timeAgo(p.createdAt)}</div>
                    </div>
                  </div>
                  {isAnonymous ? (
                    <div className="caption">Sign in to respond.</div>
                  ) : (
                    <div className="row-actions">
                      <button
                        className="soft-button"
                        onClick={() => handleReject(p.pingId)}
                      >
                        Reject
                      </button>
                      <button
                        className="soft-button soft-button--primary"
                        onClick={() =>
                          setComposer({
                            kind: "ping-back",
                            pingId: p.pingId,
                            peer: p.fromUser,
                          })
                        }
                      >
                        Ping back
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : null}

        {tab === "sent" ? (
          outgoing === null ? (
            <div className="caption">Loading…</div>
          ) : outgoing.length === 0 ? (
            <div className="caption">No pings sent.</div>
          ) : (
            <ul className="inbox-list">
              {outgoing.map((p) => (
                <li key={p.pingId} className="inbox-row">
                  <div className="row-head">
                    <UserAvatar
                      avatarId={p.toUser.avatarId}
                      photoURL={p.toUser.photoURL}
                      displayName={p.toUser.displayName}
                      size="sm"
                      pingIndicator="outgoing"
                    />
                    <div className="row-identity">
                      <div className="row-name">{p.toUser.displayName ?? "Unnamed"}</div>
                      <div className="caption">Sent {timeAgo(p.createdAt)}</div>
                    </div>
                    <button
                      className="soft-button soft-button--quiet"
                      onClick={() => handleRevoke(p.pingId)}
                    >
                      Revoke
                    </button>
                  </div>
                  <div className="disclosures">
                    <div className="section-label small-label">You offered</div>
                    <ContactLinks contacts={p.contacts} />
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}

        <div className="caption">
          Mutual pings confirm connections. Pings fade after 30 days.
        </div>

        <style>{`
          .inbox {
            position: fixed;
            top: 92px;
            right: 18px;
            width: min(440px, calc(100vw - 36px));
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-height: calc(100vh - 110px);
            overflow-y: auto;
            z-index: 40;
          }
          .inbox-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .inbox-title {
            font-size: 0.95rem;
            margin: 0;
            font-weight: 500;
          }
          .inbox-tabs {
            display: flex;
            gap: 4px;
            border-bottom: 1px solid var(--mist, rgba(255,255,255,0.08));
          }
          .inbox-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .inbox-row {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 10px;
            background: rgba(255, 255, 255, 0.02);
            border-radius: 8px;
          }
          .row-head {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .row-identity {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .row-name {
            font-size: 0.88rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .row-actions {
            display: flex;
            justify-content: flex-end;
            gap: 0.4rem;
          }
          .disclosures {
            display: flex;
            flex-direction: column;
            gap: 0.3rem;
          }
          .small-label {
            margin-top: 4px;
          }
          .contact-links {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .contact-link-row {
            display: flex;
            align-items: center;
            gap: 0.55rem;
            padding: 0.15rem 0;
          }
          .contact-link-row .contact-type {
            font-size: 0.6rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: var(--muted, rgba(255,255,255,0.55));
            min-width: 110px;
          }
          .contact-link-row .contact-value {
            font-size: 0.85rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .contact-link-row .link {
            color: var(--signal, #5ee7d9);
            text-decoration: none;
          }
          .contact-link-row .link:hover {
            text-decoration: underline;
          }
        `}</style>
      </div>

      {composer ? (
        <PingComposer
          title={`Ping back ${composer.peer.displayName ?? "Unnamed"}`}
          peerDisplayName={composer.peer.displayName ?? "them"}
          submitLabel="Ping back"
          onSubmit={handlePingBackSubmit}
          onCancel={() => setComposer(null)}
        />
      ) : null}
    </>
  );
}

function TabButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`tab-button ${active ? "active" : ""}`}
      onClick={onClick}
      role="tab"
      aria-selected={active}
    >
      <span>{children}</span>
      {count > 0 ? <span className="count-badge">{count}</span> : null}
      <style>{`
        .tab-button {
          background: transparent;
          border: none;
          color: var(--text-muted, rgba(255,255,255,0.6));
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          padding: 0.5rem 0.75rem;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }
        .tab-button.active {
          color: var(--signal, #5ee7d9);
          border-bottom-color: var(--signal, #5ee7d9);
        }
      `}</style>
    </button>
  );
}
