import { cn } from "@/lib/utils";

type Props = {
  size?: number;
  onClick?: () => void;
  dim?: boolean;
  className?: string;
};

export function Wordmark({ size = 17, onClick, dim, className }: Props) {
  const inkStroke = dim ? "var(--ink2)" : "var(--ink)";
  const accentStroke = "var(--accent-color)";

  const inner = (
    <>
      <svg
        viewBox="0 0 22 14"
        width={size * (22 / 14)}
        height={size}
        fill="none"
        aria-hidden="true"
        style={{ display: "block", flexShrink: 0 }}
      >
        <circle cx={7} cy={7} r={6} stroke={inkStroke} strokeWidth={1.4} />
        <circle cx={15} cy={7} r={6} stroke={accentStroke} strokeWidth={1.4} />
      </svg>
      <span
        className="font-display"
        style={{
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: dim ? "var(--ink2)" : "var(--ink)",
          lineHeight: 1,
        }}
      >
        <span>Venn</span>
        <span className="text-brand">·</span>
        <span>bar</span>
      </span>
    </>
  );

  const baseClass = cn(
    "inline-flex items-center gap-1.5 select-none",
    onClick && "cursor-pointer",
    className,
  );

  if (onClick) {
    return (
      <button
        type="button"
        data-slot="wordmark"
        data-testid="wordmark-root"
        onClick={onClick}
        className={baseClass}
        style={{ background: "none", border: "none", padding: 0 }}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      data-slot="wordmark"
      data-testid="wordmark-root"
      className={baseClass}
    >
      {inner}
    </div>
  );
}
