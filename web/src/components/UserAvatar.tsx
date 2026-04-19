import { useState } from "react";
import { avatarGradient, glyphForAvatarId } from "../lib/avatars";
import type { PingIndicator } from "../lib/types";

interface Props {
  avatarId: number;
  photoURL: string | null;
  displayName: string | null;
  size?: number;
  pingIndicator?: PingIndicator;
}

export function UserAvatar({
  avatarId,
  photoURL,
  displayName,
  size = 40,
  pingIndicator = null,
}: Props) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const label = displayName || "Unnamed";
  const showPhoto = photoURL && !photoFailed;

  return (
    <span
      className="avatar-glyph"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: showPhoto ? "var(--void)" : avatarGradient(avatarId),
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 8px 18px -8px rgba(0,0,0,0.6)",
      }}
      role="img"
      aria-label={label}
    >
      {showPhoto ? (
        <img
          src={photoURL!}
          alt=""
          onError={() => setPhotoFailed(true)}
          draggable={false}
        />
      ) : (
        <span aria-hidden="true">{glyphForAvatarId(avatarId)}</span>
      )}
      {pingIndicator && <span className={`ping-ring ${pingIndicator}`} aria-hidden="true" />}
    </span>
  );
}
