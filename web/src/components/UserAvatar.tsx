import { avatarPresentation } from "@shared/domain";

import { avatarStyle } from "../lib/avatar";

type Props = {
  avatarId: number;
  photoURL?: string | null;
  displayName?: string | null;
  pingIndicator?: "incoming" | "outgoing" | "mutual" | null;
  size?: number;
};

export function UserAvatar({ avatarId, photoURL, displayName, pingIndicator = null, size = 48 }: Props) {
  const glyph = avatarPresentation(avatarId).glyph;

  return (
    <span
      className={`user-avatar ${pingIndicator ? `ping-${pingIndicator}` : ""}`}
      style={{ width: size, height: size }}
      title={displayName ?? "User"}
    >
      {photoURL ? (
        <img
          src={photoURL}
          alt={displayName ?? "User avatar"}
          onError={(event) => {
            event.currentTarget.style.display = "none";
            const fallback = event.currentTarget.parentElement?.querySelector(".user-avatar-fallback");
            if (fallback instanceof HTMLElement) {
              fallback.style.display = "grid";
            }
          }}
        />
      ) : null}
      <span
        className="user-avatar-fallback"
        style={{
          ...(photoURL ? { display: "none" } : {}),
          ...avatarStyle(avatarId)
        }}
      >
        {glyph}
      </span>
    </span>
  );
}

