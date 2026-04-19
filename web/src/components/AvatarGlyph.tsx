import { avatarGradient, glyphForAvatarId } from "../lib/avatars";

interface Props {
  avatarId: number;
  size?: number;
  title?: string;
}

export function AvatarGlyph({ avatarId, size = 40, title }: Props) {
  return (
    <span
      className="avatar-glyph"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: avatarGradient(avatarId),
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 8px 18px -8px rgba(0,0,0,0.6)`,
      }}
      role="img"
      aria-label={title ?? "user avatar"}
    >
      <span aria-hidden="true">{glyphForAvatarId(avatarId)}</span>
    </span>
  );
}
