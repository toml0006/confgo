import { useState } from "react";
import { apiFetch, type MeUser } from "../api";
import { AVATAR_COUNT, AvatarGlyph } from "./AvatarGlyph";
import { ContactsEditor } from "./ContactsEditor";
import { useAuth, type AuthProviderId } from "../auth/AuthContext";

type Props = {
  me: MeUser;
  onClose: () => void;
  onUpdated: (me: MeUser) => void;
};

export function SettingsPanel({ me, onClose, onUpdated }: Props) {
  const { user, isAnonymous, linkProvider, signOutUser } = useAuth();
  const [displayName, setDisplayName] = useState(me.displayName ?? "");
  const [avatarId, setAvatarId] = useState(me.avatarId);
  const [saving, setSaving] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [signingIn, setSigningIn] = useState<AuthProviderId | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

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

  async function save(patch: Partial<Pick<MeUser, "displayName" | "avatarId">>) {
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

  return (
    <div className="settings-panel glass-panel sheet-in">
      <div className="settings-head">
        <div className="settings-identity">
          <AvatarGlyph avatarId={avatarId} size="xl" />
          <div>
            <div className="settings-name">
              {me.displayName ?? "Unnamed"}
            </div>
            <div className="muted settings-subtitle">
              {me.email ?? "Anonymous"}
            </div>
          </div>
        </div>
        <button className="close-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="stack-sm">
        <label className="section-label">Display name</label>
        <div className="name-row">
          <input
            value={displayName}
            placeholder="e.g., Jackson T"
            maxLength={50}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <button
            className="soft-button soft-button--primary"
            disabled={saving || displayName === (me.displayName ?? "")}
            onClick={() => save({ displayName: displayName.trim() || null })}
          >
            Save
          </button>
        </div>
      </div>

      <div className="stack-sm">
        <label className="section-label">Avatar</label>
        <button
          className="soft-button"
          onClick={() => setShowGrid((x) => !x)}
        >
          {showGrid ? "Hide avatars" : "Choose avatar"}
        </button>
        {showGrid ? (
          <div className="avatar-grid">
            {Array.from({ length: AVATAR_COUNT }).map((_, i) => (
              <button
                key={i}
                className={`avatar-cell ${i === avatarId ? "selected" : ""}`}
                onClick={async () => {
                  setAvatarId(i);
                  await save({ avatarId: i });
                }}
                disabled={saving}
              >
                <AvatarGlyph avatarId={i} size="md" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="stack-sm">
        <label className="section-label">Contact cards</label>
        <ContactsEditor />
        <div className="caption">
          Picked per ping. Only revealed when someone matches back.
        </div>
      </div>

      <div className="stack-sm">
        <label className="section-label">Account</label>
        {isAnonymous ? (
          <div className="auth-buttons">
            <button
              className="soft-button provider-button"
              disabled={signingIn !== null}
              onClick={() => handleSignIn("google.com")}
            >
              <ProviderMark id="google.com" />
              {signingIn === "google.com" ? "Connecting…" : "Sign in with Google"}
            </button>
            <button
              className="soft-button provider-button"
              disabled={signingIn !== null}
              onClick={() => handleSignIn("github.com")}
            >
              <ProviderMark id="github.com" />
              {signingIn === "github.com" ? "Connecting…" : "Sign in with GitHub"}
            </button>
          </div>
        ) : (
          <div className="signed-in-row">
            <div className="signed-in-info">
              <div className="muted settings-subtitle">Signed in as</div>
              <div className="signed-in-email">
                {user?.email ?? user?.displayName ?? "Account linked"}
              </div>
            </div>
            <button
              className="soft-button"
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
            </button>
          </div>
        )}
        {authError ? <div className="auth-error">{authError}</div> : null}
      </div>

      <div className="caption">
        {isAnonymous
          ? "Anonymous session — sign in to keep your conferences across devices."
          : "Your attendances will follow this account."}
      </div>

      <style>{`
        .settings-panel {
          position: fixed;
          top: 68px;
          right: 18px;
          width: min(400px, calc(100vw - 36px));
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          max-height: calc(100vh - 86px);
          overflow-y: auto;
          z-index: 40;
        }
        .settings-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }
        .settings-identity {
          display: flex;
          gap: 0.85rem;
          align-items: center;
        }
        .settings-name {
          font-size: 0.95rem;
        }
        .settings-subtitle {
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }
        .name-row {
          display: flex;
          gap: 0.5rem;
        }
        .name-row input {
          flex: 1;
        }
        .avatar-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 0.35rem;
        }
        .avatar-cell {
          padding: 0.15rem;
          border: 1px solid transparent;
          border-radius: 999px;
        }
        .avatar-cell.selected {
          border-color: var(--signal-dim);
          box-shadow: 0 0 0 2px rgba(94, 231, 217, 0.12) inset;
          box-shadow: 0 0 0 2px color(display-p3 0.369 0.906 0.851 / 0.12) inset;
        }
        .auth-buttons {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .provider-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.55rem;
          width: 100%;
        }
        .provider-button svg {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }
        .signed-in-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .signed-in-info {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .signed-in-email {
          font-size: 0.9rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .auth-error {
          font-size: 0.8rem;
          color: var(--signal-warning);
        }
      `}</style>
    </div>
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
