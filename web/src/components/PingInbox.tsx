import { useCallback, useEffect, useState } from "react";
import {
  apiFetch,
  type IncomingPing,
  type MutualContact,
  type OutgoingPing,
  type UserSummary,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Caption,
  FloatingPanel,
} from "@/components/ui/floating-panel";
import { Kicker } from "@/components/ui/kicker";
import { Tag } from "@/components/ui/tag";
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
  if (contacts.length === 0) return <Caption>(none)</Caption>;
  return (
    <div className="flex flex-col gap-0.5">
      {contacts.map((c, idx) => {
        const href = contactHref(c);
        const label = `${CONTACT_LABELS[c.type]}${c.label ? ` · ${c.label}` : ""}`;
        return (
          <span key={idx} className="flex items-center gap-2.5 py-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink3 min-w-[110px]">
              {label}
            </span>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14px] text-brand no-underline hover:underline truncate"
              >
                {c.value}
              </a>
            ) : (
              <span className="text-[14px] text-ink truncate">{c.value}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

const ROW = "flex flex-col gap-2 p-3 bg-hair-soft rounded-[14px]";

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
      <FloatingPanel
        side="top-right"
        inset="raised"
        onClose={onClose}
        className="w-[min(440px,calc(100vw-36px))] gap-3 p-4"
      >
        <h2 className="font-display font-normal text-[20px] tracking-[-0.015em] text-ink m-0">
          Signals
        </h2>

        <div role="tablist" className="flex gap-1.5">
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

        {actionError ? (
          <div className="text-[13px] text-brand">{actionError}</div>
        ) : null}

        {tab === "matched" ? (
          matched === null ? (
            <Caption>Loading…</Caption>
          ) : matched.length === 0 ? (
            <Caption>No matches yet.</Caption>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
              {matched.map((m) => (
                <li key={m.peer.id} className={ROW}>
                  <div className="flex items-center gap-2.5">
                    <UserAvatar
                      avatarId={m.peer.avatarId}
                      photoURL={m.peer.photoURL}
                      displayName={m.peer.displayName}
                      size="sm"
                      pingIndicator="mutual"
                    />
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="text-[14px] text-ink truncate">
                        {m.peer.displayName ?? "Unnamed"}
                      </div>
                      <Caption>Matched {timeAgo(m.matchedAt)}</Caption>
                    </div>
                    <Button
                      variant="atlas"
                      size="atlas-sm"
                      onClick={() => handleDematch(m.peer.id)}
                    >
                      Unmatch
                    </Button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Kicker className="mt-1">Theirs</Kicker>
                    <ContactLinks contacts={m.theirContacts} />
                    <Kicker className="mt-1">Yours</Kicker>
                    <ContactLinks contacts={m.yourContacts} />
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {tab === "incoming" ? (
          incoming === null ? (
            <Caption>Loading…</Caption>
          ) : incoming.length === 0 ? (
            <Caption>No pings waiting.</Caption>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
              {incoming.map((p) => (
                <li key={p.pingId} className={ROW}>
                  <div className="flex items-center gap-2.5">
                    <UserAvatar
                      avatarId={p.fromUser.avatarId}
                      photoURL={p.fromUser.photoURL}
                      displayName={p.fromUser.displayName}
                      size="sm"
                      pingIndicator="incoming"
                    />
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="text-[14px] text-ink truncate">
                        {p.fromUser.displayName ?? "Unnamed"}
                      </div>
                      <Caption>{timeAgo(p.createdAt)}</Caption>
                    </div>
                  </div>
                  {isAnonymous ? (
                    <Caption>Sign in to respond.</Caption>
                  ) : (
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="atlas"
                        size="atlas-sm"
                        onClick={() => handleReject(p.pingId)}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="atlas-primary"
                        size="atlas-sm"
                        onClick={() =>
                          setComposer({
                            kind: "ping-back",
                            pingId: p.pingId,
                            peer: p.fromUser,
                          })
                        }
                      >
                        Ping back
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : null}

        {tab === "sent" ? (
          outgoing === null ? (
            <Caption>Loading…</Caption>
          ) : outgoing.length === 0 ? (
            <Caption>No pings sent.</Caption>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
              {outgoing.map((p) => (
                <li key={p.pingId} className={ROW}>
                  <div className="flex items-center gap-2.5">
                    <UserAvatar
                      avatarId={p.toUser.avatarId}
                      photoURL={p.toUser.photoURL}
                      displayName={p.toUser.displayName}
                      size="sm"
                      pingIndicator="outgoing"
                    />
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="text-[14px] text-ink truncate">
                        {p.toUser.displayName ?? "Unnamed"}
                      </div>
                      <Caption>Sent {timeAgo(p.createdAt)}</Caption>
                    </div>
                    <Button
                      variant="atlas"
                      size="atlas-sm"
                      onClick={() => handleRevoke(p.pingId)}
                    >
                      Revoke
                    </Button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Kicker className="mt-1">You offered</Kicker>
                    <ContactLinks contacts={p.contacts} />
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}

        <Caption>
          Mutual pings confirm connections. Pings fade after 30 days.
        </Caption>
      </FloatingPanel>

      <PingComposer
        open={composer !== null}
        title={
          composer
            ? `Ping back ${composer.peer.displayName ?? "Unnamed"}`
            : ""
        }
        peerDisplayName={composer?.peer.displayName ?? "them"}
        submitLabel="Ping back"
        onSubmit={handlePingBackSubmit}
        onCancel={() => setComposer(null)}
      />
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
    <Button
      variant={active ? "atlas" : "atlas-ghost"}
      size="atlas-sm"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={active ? "bg-hair-soft" : ""}
    >
      <span className="normal-case tracking-normal">{children}</span>
      {count > 0 ? <Tag accent>{count}</Tag> : null}
    </Button>
  );
}
