import { useRef, useState } from "react";
import { apiFetch, type Conference, type MeUser, type PublicUser } from "../api";
import { UserAvatar } from "./UserAvatar";
import { ContactsEditor } from "./ContactsEditor";
import { PhotoCropper } from "./PhotoCropper";
import { PeopleVennOverlay } from "./PeopleVenn";
import { useAuth, type AuthProviderId } from "../auth/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Caption,
  FloatingPanel,
} from "@/components/ui/floating-panel";
import { Kicker } from "@/components/ui/kicker";
import { Input } from "@/components/ui/input";

type OverlapPeer = { user: PublicUser; sharedCount: number };
type AttendanceRow = { conferenceId: string; intent: "going" | "been" };
type VennState = {
  people: PublicUser[];
  conferences: Conference[];
  attendancesByUser: Map<string, string[]>;
};

type Props = {
  me: MeUser;
  onClose: () => void;
  onUpdated: (me: MeUser) => void;
  onShowIntro?: () => void;
};

export function SettingsPanel({ me, onClose, onUpdated, onShowIntro }: Props) {
  const { user, isAnonymous, linkProvider, signOutUser } = useAuth();
  const [displayName, setDisplayName] = useState(me.displayName ?? "");
  const [photoURL, setPhotoURL] = useState(me.photoURL);
  const [saving, setSaving] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [signingIn, setSigningIn] = useState<AuthProviderId | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [vennState, setVennState] = useState<VennState | null>(null);
  const [vennLoading, setVennLoading] = useState(false);
  const [vennError, setVennError] = useState<string | null>(null);

  async function openOverlapVenn() {
    setVennError(null);
    setVennLoading(true);
    try {
      // Fetch self attendances via /me/attendances — /users/:id/attendances
      // 404s for users without a visible display_name (privacy gate),
      // including anonymous "me" before they pick a name. Without this the
      // intersection in the Venn would always be empty.
      const [peersRes, confsRes, myAttRes] = await Promise.all([
        apiFetch<{ peers: OverlapPeer[] }>("/me/overlap-peers?limit=2"),
        apiFetch<{ conferences: Conference[] }>("/conferences"),
        apiFetch<{ attendances: AttendanceRow[] }>("/me/attendances"),
      ]);
      const meAsUser: PublicUser = {
        id: me.id,
        avatarId: me.avatarId,
        displayName: me.displayName,
        photoURL,
      };
      const peers = peersRes.peers.map((p) => p.user);
      // Pre-resolve every peer's attendances. Use allSettled — peers whose
      // profile is hidden / deleted (404) drop out instead of failing the
      // whole overlay.
      const peerResults = await Promise.allSettled(
        peers.map((p) =>
          apiFetch<{ attendances: AttendanceRow[] }>(
            `/users/${p.id}/attendances`,
          ).then((r) => [p.id, r.attendances.map((a) => a.conferenceId)] as const),
        ),
      );
      const attendancesByUser = new Map<string, string[]>();
      attendancesByUser.set(
        me.id,
        myAttRes.attendances.map((a) => a.conferenceId),
      );
      for (const r of peerResults) {
        if (r.status === "fulfilled") {
          attendancesByUser.set(r.value[0], r.value[1]);
        } else {
          console.warn("[overlap-venn] peer attendances failed:", r.reason);
        }
      }
      setVennState({
        people: [meAsUser, ...peers],
        conferences: confsRes.conferences,
        attendancesByUser,
      });
    } catch (err) {
      console.error("[overlap-venn]", err);
      setVennError("Couldn't load overlap.");
    } finally {
      setVennLoading(false);
    }
  }

  async function handleSignIn(id: AuthProviderId) {
    setAuthError(null);
    setSigningIn(id);
    try {
      await linkProvider(id);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // user dismissed — not an error worth surfacing
      } else {
        console.error("[auth] link failed", err);
        setAuthError(
          code === "auth/operation-not-allowed"
            ? "This provider isn't enabled for the project yet."
            : "Sign-in failed. Try again.",
        );
      }
    } finally {
      setSigningIn(null);
    }
  }

  async function save(
    patch: Partial<Pick<MeUser, "displayName" | "avatarId" | "photoURL">>,
  ) {
    setSaving(true);
    try {
      const updated = await apiFetch<MeUser>("/me", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      onUpdated(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      console.warn("[photo] not an image:", f.type);
      return;
    }
    setPendingFile(f);
  }

  async function handleCropSaved(url: string) {
    setPendingFile(null);
    setPhotoURL(url);
    await save({ photoURL: url });
  }

  async function handleRemovePhoto() {
    setPhotoURL(null);
    await save({ photoURL: null });
  }

  return (
    <>
      <FloatingPanel
        side="top-right"
        onClose={onClose}
        className="w-[min(400px,calc(100vw-36px))]"
      >
        <div className="flex justify-between items-start gap-2.5">
          <div className="flex gap-3 items-center">
            <UserAvatar
              avatarId={me.avatarId}
              photoURL={photoURL}
              displayName={me.displayName}
              size="xl"
            />
            <div>
              <div className="font-display font-normal text-[1.5rem] text-ink">
                {me.displayName ?? "Unnamed"}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink2">
                {me.email ?? "Anonymous"}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Kicker>Conference overlap</Kicker>
          <Button
            variant="atlas"
            size="atlas"
            disabled={vennLoading}
            onClick={openOverlapVenn}
            className="self-start"
          >
            {vennLoading ? "Loading…" : "View overlap diagram"}
          </Button>
          {vennError ? (
            <div className="text-[13px] text-brand">{vennError}</div>
          ) : null}
          <Caption>
            Venn of conferences you share with the two people whose attendance most overlaps yours.
          </Caption>
        </div>

        <div className="flex flex-col gap-1.5">
          <Kicker>Display name</Kicker>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              value={displayName}
              placeholder="e.g., Jackson T"
              maxLength={50}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <Button
              variant="atlas-primary"
              size="atlas"
              disabled={saving || displayName === (me.displayName ?? "")}
              onClick={() => save({ displayName: displayName.trim() || null })}
            >
              Save
            </Button>
          </div>
        </div>

        {!isAnonymous ? (
          <div className="flex flex-col gap-1.5">
            <Kicker>Photo</Kicker>
            <div className="flex gap-1.5">
              <Button
                variant="atlas"
                size="atlas"
                disabled={saving}
                onClick={() => fileInputRef.current?.click()}
              >
                {photoURL ? "Replace photo" : "Upload photo"}
              </Button>
              {photoURL ? (
                <Button
                  variant="atlas"
                  size="atlas"
                  disabled={saving}
                  onClick={handleRemovePhoto}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFilePicked}
              className="hidden"
            />
            <Caption>
              {photoURL
                ? "Your photo replaces the avatar everywhere."
                : "Optional. Falls back to the avatar below."}
            </Caption>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Kicker>Contact cards</Kicker>
          <ContactsEditor />
          <Caption>
            Picked per ping. Only revealed when someone matches back.
          </Caption>
        </div>
        <div className="flex flex-col gap-1.5">
          <Kicker>Account</Kicker>
          {isAnonymous ? (
            <div className="flex flex-col gap-1.5">
              <Button
                variant="atlas"
                size="atlas"
                disabled={signingIn !== null}
                onClick={() => handleSignIn("google.com")}
                className="w-full normal-case tracking-normal [&>svg]:w-[18px] [&>svg]:h-[18px] [&>svg]:shrink-0"
              >
                <ProviderMark id="google.com" />
                {signingIn === "google.com" ? "Connecting…" : "Sign in with Google"}
              </Button>
              <Button
                variant="atlas"
                size="atlas"
                disabled={signingIn !== null}
                onClick={() => handleSignIn("github.com")}
                className="w-full normal-case tracking-normal [&>svg]:w-[18px] [&>svg]:h-[18px] [&>svg]:shrink-0"
              >
                <ProviderMark id="github.com" />
                {signingIn === "github.com" ? "Connecting…" : "Sign in with GitHub"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex flex-col gap-0.5">
                <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink2">
                  Signed in as
                </div>
                <div className="text-[14px] text-ink truncate">
                  {user?.email ?? user?.displayName ?? "Account linked"}
                </div>
              </div>
              <Button
                variant="atlas"
                size="atlas"
                disabled={signingIn !== null}
                onClick={async () => {
                  try {
                    await signOutUser();
                  } catch (err) {
                    console.error(err);
                  }
                }}
              >
                Sign out
              </Button>
            </div>
          )}
          {authError ? (
            <div className="text-[13px] text-brand">{authError}</div>
          ) : null}
        </div>

        {onShowIntro ? (
          <div className="flex flex-col gap-1.5">
            <Kicker>Help</Kicker>
            <Button
              variant="atlas-ghost"
              size="atlas"
              onClick={onShowIntro}
              className="w-full justify-start"
            >
              Run intro
            </Button>
            <Caption>
              A 5-screen tour of what Venn·bar is for, and how to use it.
            </Caption>
          </div>
        ) : null}

        <Caption>
          {isAnonymous
            ? "Anonymous session — sign in to keep your conferences across devices."
            : "Your attendances will follow this account."}
        </Caption>
      </FloatingPanel>

      <PhotoCropper
        file={pendingFile}
        onCancel={() => setPendingFile(null)}
        onSave={handleCropSaved}
      />

      {vennState ? (
        <PeopleVennOverlay
          people={vennState.people}
          conferences={vennState.conferences}
          attendancesByUser={vennState.attendancesByUser}
          title={`Conference overlap · ${vennState.people.length} people`}
          onClose={() => setVennState(null)}
          meId={me.id}
          canPing={!isAnonymous}
        />
      ) : null}
    </>
  );
}

function ProviderMark({ id }: { id: AuthProviderId }) {
  if (id === "google.com") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .5C5.73.5.67 5.56.67 11.83c0 5.01 3.24 9.26 7.74 10.76.57.1.78-.24.78-.54 0-.27-.01-.98-.01-1.92-3.15.68-3.82-1.52-3.82-1.52-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.69.08-.69 1.15.08 1.76 1.19 1.76 1.19 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.73-1.52-2.52-.29-5.17-1.26-5.17-5.62 0-1.24.44-2.26 1.17-3.05-.12-.29-.51-1.45.11-3.03 0 0 .96-.31 3.15 1.16a10.96 10.96 0 0 1 5.73 0c2.19-1.47 3.15-1.16 3.15-1.16.62 1.58.23 2.74.11 3.03.73.79 1.16 1.81 1.16 3.05 0 4.37-2.66 5.33-5.19 5.61.41.35.78 1.04.78 2.1 0 1.51-.01 2.73-.01 3.1 0 .3.21.65.79.54 4.49-1.5 7.73-5.75 7.73-10.76C23.33 5.56 18.27.5 12 .5z"
      />
    </svg>
  );
}
