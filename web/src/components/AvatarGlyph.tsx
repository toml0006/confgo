import type { CSSProperties } from "react";

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

function hslToP3(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) =>
    ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const r = f(0).toFixed(4);
  const g = f(8).toFixed(4);
  const b = f(4).toFixed(4);
  return `color(display-p3 ${r} ${g} ${b})`;
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
  const colorSrgb = `hsl(${h} 70% 72%)`;
  const bgInnerSrgb = `hsl(${h} 65% 30%)`;
  const bgOuterSrgb = `hsl(${(h + 20) % 360} 55% 12%)`;
  const colorP3 = hslToP3(h, 70, 72);
  const bgInnerP3 = hslToP3(h, 65, 30);
  const bgOuterP3 = hslToP3((h + 20) % 360, 55, 12);
  return (
    <span
      className="avatar-glyph"
      style={
        {
          width: px,
          height: px,
          fontSize,
          "--glyph-bg": `radial-gradient(circle at 30% 25%, ${bgInnerSrgb}, ${bgOuterSrgb})`,
          "--glyph-bg-p3": `radial-gradient(circle at 30% 25%, ${bgInnerP3}, ${bgOuterP3})`,
          "--glyph-color": colorSrgb,
          "--glyph-color-p3": colorP3,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {glyph}
    </span>
  );
}

export const AVATAR_COUNT = GLYPHS.length;
