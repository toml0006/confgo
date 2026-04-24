import { AvatarGlyph } from "./AvatarGlyph";

export type PingIndicator = "incoming" | "outgoing" | "mutual" | "none";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

type Props = {
  avatarId: number;
  photoURL?: string | null;
  displayName?: string | null;
  size?: Size;
  pingIndicator?: PingIndicator;
};

const SIZE_PX: Record<Size, number> = { xs: 22, sm: 28, md: 36, lg: 48, xl: 72 };

export function UserAvatar({
  avatarId,
  photoURL,
  displayName,
  size = "md",
  pingIndicator = "none",
}: Props) {
  const inner = photoURL ? (
    <img
      className="avatar-photo"
      src={photoURL}
      alt=""
      width={SIZE_PX[size]}
      height={SIZE_PX[size]}
    />
  ) : (
    <AvatarGlyph avatarId={avatarId} size={size} />
  );

  const aria =
    pingIndicator === "mutual"
      ? `Matched with ${displayName ?? "them"}`
      : pingIndicator === "incoming"
        ? `${displayName ?? "They"} pinged you`
        : pingIndicator === "outgoing"
          ? `You pinged ${displayName ?? "them"}`
          : undefined;

  return (
    <span
      className={`avatar-wrap avatar-wrap--${pingIndicator}`}
      aria-label={aria}
      role={aria ? "img" : undefined}
    >
      {inner}
      <style>{`
        .avatar-wrap {
          position: relative;
          display: inline-flex;
          border-radius: 999px;
          flex-shrink: 0;
        }
        .avatar-wrap::after {
          content: "";
          position: absolute;
          inset: -3px;
          border-radius: 999px;
          border: 2px solid transparent;
          pointer-events: none;
          transition: border-color 180ms ease, box-shadow 180ms ease;
        }
        .avatar-wrap--mutual::after {
          border-color: var(--signal);
          box-shadow: 0 0 14px rgba(94, 231, 217, 0.35);
        }
        .avatar-wrap--outgoing::after {
          border-color: var(--signal-dim);
        }
        .avatar-wrap--incoming::after {
          border-color: var(--ember);
          animation: ping-pulse 2s ease-in-out infinite;
        }
      `}</style>
    </span>
  );
}
