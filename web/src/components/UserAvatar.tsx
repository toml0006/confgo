import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PersonToken } from "./PersonToken";

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

const INDICATOR_RING: Record<PingIndicator, string> = {
  none: "",
  mutual:
    "after:border-signal after:[box-shadow:0_0_14px_rgba(94,231,217,0.35)]",
  outgoing: "after:border-signal-dim",
  incoming: "after:border-ember after:animate-ping-pulse",
};

export function UserAvatar({
  avatarId,
  photoURL,
  displayName,
  size = "md",
  pingIndicator = "none",
}: Props) {
  const px = SIZE_PX[size];
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
      aria-label={aria}
      role={aria ? "img" : undefined}
      className={cn(
        "relative inline-flex rounded-full shrink-0",
        "after:content-[''] after:absolute after:-inset-[3px] after:rounded-full",
        "after:border-2 after:border-transparent after:pointer-events-none",
        "after:transition-[border-color,box-shadow] after:duration-200",
        INDICATOR_RING[pingIndicator],
      )}
    >
      <Avatar
        style={{ width: px, height: px }}
        className="bg-transparent"
      >
        {photoURL ? (
          <AvatarImage
            src={photoURL}
            alt=""
            width={px}
            height={px}
            className="object-cover"
          />
        ) : null}
        <AvatarFallback className="bg-transparent p-0">
          <PersonToken
            avatarId={avatarId}
            displayName={displayName}
            size={px}
          />
        </AvatarFallback>
      </Avatar>
    </span>
  );
}
