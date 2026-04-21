import { AvatarGlyph } from "./AvatarGlyph";

type PingIndicator = "incoming" | "outgoing" | "mutual" | "none";

type Props = {
  avatarId: number;
  photoURL?: string | null;
  displayName?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pingIndicator?: PingIndicator; // forward-compat; unused in baseline
};

export function UserAvatar({ avatarId, photoURL, size = "md" }: Props) {
  // NOTE: photoURL rendering intentionally deferred — baseline ships glyph-only.
  if (photoURL) {
    const SIZE_PX = { xs: 22, sm: 28, md: 36, lg: 48, xl: 72 } as const;
    return (
      <img
        className="avatar-photo"
        src={photoURL}
        alt=""
        width={SIZE_PX[size]}
        height={SIZE_PX[size]}
      />
    );
  }
  return <AvatarGlyph avatarId={avatarId} size={size} />;
}
