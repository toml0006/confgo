import { useState } from "react";
import { apiFetch, type MeUser } from "../api";
import { AVATAR_COUNT, AvatarGlyph } from "./AvatarGlyph";

type Props = {
  me: MeUser;
  onClose: () => void;
  onUpdated: (me: MeUser) => void;
};

export function SettingsPanel({ me, onClose, onUpdated }: Props) {
  const [displayName, setDisplayName] = useState(me.displayName ?? "");
  const [avatarId, setAvatarId] = useState(me.avatarId);
  const [saving, setSaving] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

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

      <div className="caption">
        Anonymous session. Profile photos and account linking will land in a later
        update.
      </div>

      <style>{`
        .settings-panel {
          position: fixed;
          top: 92px;
          right: 18px;
          width: min(400px, calc(100vw - 36px));
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          max-height: calc(100vh - 110px);
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
        }
      `}</style>
    </div>
  );
}
