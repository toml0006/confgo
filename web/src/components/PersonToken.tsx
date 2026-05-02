import { cn } from "@/lib/utils";

const SHAPES = ["circle", "triangle", "diamond", "square", "hex"] as const;
type Shape = (typeof SHAPES)[number];

export const AVATAR_COUNT = 30;

type Props = {
  avatarId: number;
  displayName?: string | null;
  size?: number;
  className?: string;
};

function shapeFor(avatarId: number): Shape {
  const idx = ((avatarId % SHAPES.length) + SHAPES.length) % SHAPES.length;
  return SHAPES[idx];
}

function colorFor(avatarId: number): string {
  return `hsl(${(avatarId * 47) % 360} 60% 48%)`;
}

function initialFor(displayName?: string | null): string {
  if (!displayName) return "?";
  const ch = displayName.trim().charAt(0);
  return ch ? ch.toUpperCase() : "?";
}

function hexPoints(s: number): string {
  const cx = s / 2;
  const cy = s / 2;
  const r = s / 2 - 2;
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 6 + (i * Math.PI) / 3;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

export function PersonToken({
  avatarId,
  displayName,
  size = 36,
  className,
}: Props) {
  const shape = shapeFor(avatarId);
  const fill = colorFor(avatarId);
  const initial = initialFor(displayName);
  const s = size;
  const fontSize = Math.round(s * 0.42);

  let shapeEl: React.ReactNode;
  switch (shape) {
    case "circle":
      shapeEl = <circle cx={s / 2} cy={s / 2} r={s / 2 - 2} fill={fill} />;
      break;
    case "triangle":
      shapeEl = (
        <polygon
          points={`${s / 2},2 ${s - 2},${s - 2} 2,${s - 2}`}
          fill={fill}
        />
      );
      break;
    case "diamond":
      shapeEl = (
        <polygon
          points={`${s / 2},2 ${s - 2},${s / 2} ${s / 2},${s - 2} 2,${s / 2}`}
          fill={fill}
        />
      );
      break;
    case "square":
      shapeEl = <rect x={2} y={2} width={s - 4} height={s - 4} rx={2} fill={fill} />;
      break;
    case "hex":
      shapeEl = <polygon points={hexPoints(s)} fill={fill} />;
      break;
  }

  return (
    <span
      data-slot="person-token"
      data-shape={shape}
      data-testid="person-token"
      aria-hidden="true"
      className={cn("inline-flex shrink-0", className)}
      style={{ width: s, height: s, lineHeight: 0 }}
    >
      <svg
        viewBox={`0 0 ${s} ${s}`}
        width={s}
        height={s}
        style={{ display: "block" }}
      >
        {shapeEl}
        <text
          x={s / 2}
          y={s / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          className="font-ui"
          style={{ fontWeight: 700, fontSize }}
        >
          {initial}
        </text>
      </svg>
    </span>
  );
}
