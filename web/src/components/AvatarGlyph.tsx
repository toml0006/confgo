const GLYPHS = [
  "◆", "◇", "★", "☆", "❄", "❅", "❆", "✦", "✧", "✪", "✫", "✬",
  "➤", "➣", "➢", "➟", "➔", "➜", "➙", "➝",
  "◈", "◉", "◎", "●", "○", "◐", "◑", "◒", "◓",
  "▲", "△", "▴", "▽", "▾",
  "■", "□", "◧", "◨", "◩", "◪",
  "♦", "♢", "♠", "♣", "♥", "♡",
  "☾", "☽",
];

function hue(i: number): number {
  // deterministic spread across the color wheel with a consistent saturation
  return (i * 37) % 360;
}

type Size = "xs" | "sm" | "md" | "lg" | "xl";
const SIZE_PX: Record<Size, number> = { xs: 22, sm: 28, md: 36, lg: 48, xl: 72 };

export function AvatarGlyph({
  avatarId,
  size = "md",
}: {
  avatarId: number;
  size?: Size;
}) {
  const i = ((avatarId % GLYPHS.length) + GLYPHS.length) % GLYPHS.length;
  const glyph = GLYPHS[i];
  const h = hue(i);
  const px = SIZE_PX[size];
  const fontSize = Math.round(px * 0.5);
  const color = `hsl(${h} 70% 72%)`;
  const bgInner = `hsl(${h} 65% 30%)`;
  const bgOuter = `hsl(${(h + 20) % 360} 55% 12%)`;
  return (
    <span
      className="avatar-glyph"
      style={{
        width: px,
        height: px,
        background: `radial-gradient(circle at 30% 25%, ${bgInner}, ${bgOuter})`,
        color,
        fontSize,
      }}
      aria-hidden="true"
    >
      {glyph}
    </span>
  );
}

export const AVATAR_COUNT = GLYPHS.length;
