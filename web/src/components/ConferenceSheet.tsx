import { useEffect, useState } from "react";
import {
  apiFetch,
  type AttendanceIntent,
  type Attendee,
  type Conference,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import type { ContactEntry } from "../lib/contacts";
import { isFuture as isFutureFn } from "../lib/decay";
import { Button } from "@/components/ui/button";
import { Caption, FloatingPanel } from "@/components/ui/floating-panel";
import { Kicker } from "@/components/ui/kicker";
import { Tag } from "@/components/ui/tag";
import { PingComposer } from "./PingComposer";
import { PremiumCard } from "./PremiumCard";
import { UserAvatar } from "./UserAvatar";

type Props = {
  conference: Conference;
  myIntent: AttendanceIntent | undefined;
  onBack?: () => void;
  onClose: () => void;
  onMarked: () => void;
  onOpenPeer: (userId: string) => void;
};

export function ConferenceSheet({
  conference,
  myIntent,
  onBack,
  onClose,
  onMarked,
  onOpenPeer,
}: Props) {
  const { isAnonymous } = useAuth();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [busy, setBusy] = useState(false);
  const [composerFor, setComposerFor] = useState<Attendee | null>(null);

  async function loadAttendees() {
    try {
      const data = await apiFetch<{ attendees: Attendee[] }>(
        `/conferences/${conference.id}/attendees`,
      );
      setAttendees(data.attendees);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadAttendees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conference.id]);

  async function mark(intent: AttendanceIntent) {
    setBusy(true);
    try {
      await apiFetch(`/conferences/${conference.id}/attend`, {
        method: "POST",
        body: JSON.stringify({ intent }),
      });
      onMarked();
      await loadAttendees();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function unmark() {
    setBusy(true);
    try {
      await apiFetch(`/conferences/${conference.id}/attend`, { method: "DELETE" });
      onMarked();
      await loadAttendees();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function handlePingSubmit(contacts: ContactEntry[]) {
    if (!composerFor) return;
    await apiFetch(`/users/${composerFor.userId}/ping`, {
      method: "POST",
      body: JSON.stringify({ contacts }),
    });
    setComposerFor(null);
    await loadAttendees();
  }

  const now = new Date();
  const isPast = new Date(conference.endDate) < now;
  const isFuture = isFutureFn(conference.startDate, now);

  const startDateStr = new Date(conference.startDate).toLocaleDateString();
  const endDateStr =
    conference.endDate && conference.endDate !== conference.startDate
      ? new Date(conference.endDate).toLocaleDateString()
      : null;
  const dateLabel = endDateStr ? `${startDateStr} – ${endDateStr}` : startDateStr;

  // Title: italicize the last word in brand color (per Atlas spec) — only when
  // there's more than one word, otherwise keep the title plain.
  const lastSpace = conference.name.lastIndexOf(" ");
  const titleHead =
    lastSpace > 0 ? conference.name.slice(0, lastSpace) : conference.name;
  const titleTail = lastSpace > 0 ? conference.name.slice(lastSpace + 1) : null;

  return (
    <FloatingPanel
      side="top-left"
      onBack={onBack}
      onClose={onClose}
    >
      {conference.premium ? (
        <PremiumCard conference={conference} />
      ) : (
        <div className="flex flex-col gap-2">
          <Kicker accent>
            {(conference.source ?? "conference")} <span className="text-ink3">·</span> {dateLabel}
          </Kicker>
          <h2 className="m-0 font-display font-normal text-[1.6rem] leading-[1.05] tracking-[-0.025em] text-ink">
            {titleTail ? (
              <>
                {titleHead}{" "}
                <em className="italic text-brand">{titleTail}</em>
              </>
            ) : (
              conference.name
            )}
          </h2>
          <div className="text-[13px] text-ink2">
            {conference.locationName}{" "}
            <span className="text-ink3">·</span> {dateLabel}
          </div>
        </div>
      )}
      {(() => {
        // Show the full tag set: union of `topics` (curated) + `tags` (raw),
        // deduped, since the API returns both and they often differ.
        const set = new Set<string>([
          ...(conference.topics ?? []),
          ...(conference.tags ?? []),
        ]);
        const all = Array.from(set);
        if (all.length === 0) return null;
        return (
          <div className="flex gap-1.5 flex-wrap">
            {all.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        );
      })()}

      <div className="flex gap-2 flex-wrap items-center">
        {/* Toggle pair: filled = currently selected, outlined = available
            choice. Clicking the active (filled) button unmarks; clicking
            the inactive one marks (or switches). Tense gates each
            button — you can't claim past attendance for an event that
            hasn't started, nor pre-RSVP an event that's already over. */}
        {!isPast ? (
          <Button
            variant={myIntent === "going" ? "atlas-future-solid" : "atlas-future"}
            size="atlas"
            disabled={busy}
            onClick={() =>
              myIntent === "going" ? unmark() : mark("going")
            }
          >
            I'll be there
          </Button>
        ) : null}
        {!isFuture ? (
          <Button
            variant={myIntent === "been" ? "atlas-past-solid" : "atlas-past"}
            size="atlas"
            disabled={busy}
            onClick={() =>
              myIntent === "been" ? unmark() : mark("been")
            }
          >
            I was there
          </Button>
        ) : null}
      </div>

      <Kicker>Attendees · {attendees.length}</Kicker>
      {attendees.length === 0 ? (
        <Caption>No one's marked this yet.</Caption>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
          {attendees.map((a) => (
            <div
              key={a.userId}
              title={a.displayName ?? ""}
              className="flex items-center gap-1.5 p-2 bg-bg border border-hair rounded-[10px] hover:border-ink3 transition-colors"
            >
              <button
                type="button"
                disabled={a.isYou}
                onClick={() => !a.isYou && onOpenPeer(a.userId)}
                className="flex items-center gap-2 flex-1 min-w-0 bg-transparent border-none p-0 cursor-pointer text-current text-left disabled:cursor-default"
              >
                <UserAvatar
                  avatarId={a.avatarId}
                  photoURL={a.photoURL}
                  displayName={a.displayName}
                  size="md"
                  pingIndicator={
                    a.isYou
                      ? "none"
                      : a.youPinged && a.hasPingedYou
                        ? "mutual"
                        : a.hasPingedYou
                          ? "incoming"
                          : a.youPinged
                            ? "outgoing"
                            : "none"
                  }
                />
                <div className="flex flex-col min-w-0">
                  <div className="text-[13px] text-ink truncate">
                    {a.isYou ? "You" : a.displayName ?? "Unnamed"}
                  </div>
                  <Kicker className="text-[10px]">
                    {isPast ? "been" : "going"}
                  </Kicker>
                </div>
              </button>
              <AttendeePing
                attendee={a}
                isAnonymous={isAnonymous}
                onPing={() => setComposerFor(a)}
              />
            </div>
          ))}
        </div>
      )}

      {conference.url ? (
        <Button asChild variant="atlas-ghost" size="atlas-sm" className="self-start">
          <a href={conference.url} target="_blank" rel="noreferrer">
            Visit site ↗
          </a>
        </Button>
      ) : null}

      <PingComposer
        open={composerFor !== null}
        title={
          composerFor ? `Ping ${composerFor.displayName ?? "Unnamed"}` : ""
        }
        peerDisplayName={composerFor?.displayName ?? "them"}
        submitLabel={composerFor?.hasPingedYou ? "Ping back" : "Send ping"}
        onSubmit={handlePingSubmit}
        onCancel={() => setComposerFor(null)}
      />
    </FloatingPanel>
  );
}

function AttendeePing({
  attendee,
  isAnonymous,
  onPing,
}: {
  attendee: Attendee;
  isAnonymous: boolean;
  onPing: () => void;
}) {
  if (attendee.isYou) return null;
  const mutual = attendee.youPinged && attendee.hasPingedYou;
  const sent = attendee.youPinged && !attendee.hasPingedYou;
  const incoming = !attendee.youPinged && attendee.hasPingedYou;
  // Pings require a real account — anonymous sessions can't send or
  // receive disclosures. Hide ping affordances entirely; matched/pinged
  // tags still show because those are public state, not actions.
  if (isAnonymous && !mutual && !sent) return null;
  return (
    <div className="shrink-0 flex items-center">
      {mutual ? (
        <Tag accent>✓ Matched</Tag>
      ) : sent ? (
        <Tag>Pinged</Tag>
      ) : (
        <Button
          type="button"
          onClick={onPing}
          variant={incoming ? "atlas-primary" : "atlas"}
          size="atlas-sm"
        >
          {incoming ? "Ping back" : "Ping"}
        </Button>
      )}
    </div>
  );
}
