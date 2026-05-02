import { useCallback, useEffect, useState } from "react";
import { apiFetch, type Conference, type UserProfile } from "../api";
import { useAuth } from "../auth/AuthContext";
import type { ContactEntry } from "../lib/contacts";
import { Button } from "@/components/ui/button";
import { Caption, FloatingPanel } from "@/components/ui/floating-panel";
import { Kicker } from "@/components/ui/kicker";
import { Tag } from "@/components/ui/tag";
import { VennChart } from "@/components/ui/venn-chart";
import { PingComposer } from "./PingComposer";
import { UserAvatar } from "./UserAvatar";

type Props = {
  userId: string;
  onBack?: () => void;
  onClose: () => void;
  onOpenConference: (conf: Conference) => void;
};

export function PeerSheet({ userId, onBack, onClose, onOpenConference }: Props) {
  const { isAnonymous } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<UserProfile>(`/users/${userId}/profile`);
      setProfile(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(contacts: ContactEntry[]) {
    setActionError(null);
    await apiFetch(`/users/${userId}/ping`, {
      method: "POST",
      body: JSON.stringify({ contacts }),
    });
    setComposerOpen(false);
    await load();
  }

  if (!profile) {
    return (
      <FloatingPanel side="top-left" inset="raised" onBack={onBack} onClose={onClose}>
        <Caption>{error ?? "Loading…"}</Caption>
      </FloatingPanel>
    );
  }

  const { user, shared, pingState } = profile;
  const pingStatus = pingStatusOf(pingState);
  const displayName = user.displayName ?? "Unnamed";
  const firstName = displayName.split(" ")[0];

  return (
    <>
      <FloatingPanel
        side="top-left"
        inset="raised"
        onBack={onBack}
        onClose={onClose}
        className="gap-5"
      >
        <div className="flex flex-col gap-3">
          <Kicker accent>The overlap</Kicker>
          <h1 className="m-0 font-display font-normal text-[2.2rem] leading-[1.05] tracking-[-0.025em] text-ink">
            {shared.length > 0 ? (
              <>
                You and{" "}
                <em className="italic text-brand">{firstName}</em> have crossed
                paths at {shared.length} of the same{" "}
                {shared.length === 1 ? "event" : "events"}.
              </>
            ) : (
              <>
                You and{" "}
                <em className="italic text-brand">{firstName}</em> haven't crossed
                paths yet.
              </>
            )}
          </h1>
        </div>

        <div className="flex justify-center">
          <VennChart
            size={280}
            leftCount={0}
            rightCount={0}
            sharedCount={shared.length}
            leftLabel="You"
            rightLabel={firstName}
          />
        </div>

        <div className="flex gap-3 items-center">
          <UserAvatar
            avatarId={user.avatarId}
            photoURL={user.photoURL}
            displayName={user.displayName}
            size="xl"
            pingIndicator={
              pingStatus === "matched"
                ? "mutual"
                : pingStatus === "incoming"
                  ? "incoming"
                  : pingStatus === "sent"
                    ? "outgoing"
                    : "none"
            }
          />
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="font-display text-[18px] text-ink truncate">
              {displayName}
            </div>
            <Caption>
              {shared.length === 0
                ? "No shared conferences."
                : `${shared.length} shared conference${shared.length === 1 ? "" : "s"}.`}
            </Caption>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {pingStatus === "matched" ? (
            <Tag accent>✓ Matched</Tag>
          ) : pingStatus === "sent" ? (
            <Tag>· Pinged</Tag>
          ) : isAnonymous ? null : pingStatus === "incoming" ? (
            <Button
              variant="atlas-primary"
              size="atlas"
              onClick={() => setComposerOpen(true)}
            >
              Ping back
            </Button>
          ) : pingStatus === "none" ? (
            <Button
              variant="atlas-primary"
              size="atlas"
              onClick={() => setComposerOpen(true)}
            >
              Send ping
            </Button>
          ) : null}
        </div>

        {actionError ? (
          <div className="text-[13px] text-brand">{actionError}</div>
        ) : null}

        {shared.length > 0 ? (
          <>
            <Kicker>Shared · {shared.length}</Kicker>
            <div className="flex flex-col gap-1.5">
              {shared.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onOpenConference(c)}
                  className="grid grid-cols-[110px_1fr_auto] gap-2.5 items-center px-3 py-2 bg-bg border border-hair rounded-[10px] text-left hover:border-ink3 transition-colors"
                >
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink3 whitespace-nowrap">
                    {new Date(c.startDate).toLocaleDateString()}
                  </span>
                  <span className="font-display text-[14px] text-ink overflow-hidden text-ellipsis whitespace-nowrap">
                    {c.name}
                  </span>
                  <Tag accent>Both went</Tag>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </FloatingPanel>

      <PingComposer
        open={composerOpen}
        title={`Ping ${displayName}`}
        peerDisplayName={displayName}
        submitLabel={pingStatus === "incoming" ? "Ping back" : "Send ping"}
        onSubmit={handleSubmit}
        onCancel={() => setComposerOpen(false)}
      />
    </>
  );
}

type PingStatus = "none" | "sent" | "incoming" | "matched" | "self";

function pingStatusOf(s: UserProfile["pingState"]): PingStatus {
  if (!s) return "self";
  if (s.youPinged && s.hasPingedYou) return "matched";
  if (s.youPinged) return "sent";
  if (s.hasPingedYou) return "incoming";
  return "none";
}
