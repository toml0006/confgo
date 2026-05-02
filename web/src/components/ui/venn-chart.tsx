import * as React from "react";

import { cn } from "@/lib/utils";

type VennChartProps = {
  size?: number;
  leftCount: number;
  rightCount: number;
  sharedCount: number;
  leftLabel?: string;
  rightLabel?: string;
  leftFill?: string;
  rightFill?: string;
  fillOpacity?: number;
  textColor?: string;
  className?: string;
};

function VennChart({
  size = 240,
  leftCount,
  rightCount,
  sharedCount,
  leftLabel,
  rightLabel,
  leftFill = "var(--ink)",
  rightFill = "var(--accent-color)",
  fillOpacity = 0.18,
  textColor = "var(--ink)",
  className,
}: VennChartProps) {
  const reactId = React.useId();
  const clipId = `venn-clip-${reactId.replace(/:/g, "")}`;

  const r = size * 0.3;
  const cx1 = size * 0.5 - r * 0.55;
  const cx2 = size * 0.5 + r * 0.55;
  const cy = size * 0.5;

  const numeralFontSize = size * 0.13;
  const sharedFontSize = size * 0.16;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      data-slot="venn-chart"
      className={cn(className)}
    >
      <defs>
        <clipPath id={clipId}>
          {/* Path describing the left circle — kept as <path> so consumers
              can count circles as (left, right, intersection) without the
              clip-source skewing the total. */}
          <path
            d={`M ${cx1 - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0 z`}
          />
        </clipPath>
      </defs>

      {/* Left circle */}
      <circle
        cx={cx1}
        cy={cy}
        r={r}
        fill={leftFill}
        fillOpacity={fillOpacity}
        stroke={leftFill}
        strokeWidth={1}
        strokeOpacity={0.85}
      />

      {/* Right circle */}
      <circle
        cx={cx2}
        cy={cy}
        r={r}
        fill={rightFill}
        fillOpacity={fillOpacity}
        stroke={rightFill}
        strokeWidth={1}
        strokeOpacity={0.85}
      />

      {/* Intersection: re-draw right circle clipped to left */}
      <g clipPath={`url(#${clipId})`}>
        <circle
          cx={cx2}
          cy={cy}
          r={r}
          fill={rightFill}
          fillOpacity={fillOpacity}
        />
      </g>

      {leftLabel ? (
        <text
          x={cx1 - r * 0.55}
          y={cy - r - 8}
          fontFamily="Inter, sans-serif"
          fontSize={10}
          fontWeight={600}
          letterSpacing="0.16em"
          fill={textColor}
          fillOpacity={0.55}
          textAnchor="middle"
        >
          {leftLabel.toUpperCase()}
        </text>
      ) : null}

      {rightLabel ? (
        <text
          x={cx2 + r * 0.55}
          y={cy - r - 8}
          fontFamily="Inter, sans-serif"
          fontSize={10}
          fontWeight={600}
          letterSpacing="0.16em"
          fill={textColor}
          fillOpacity={0.55}
          textAnchor="middle"
        >
          {rightLabel.toUpperCase()}
        </text>
      ) : null}

      {/* Left numeral */}
      <text
        x={cx1 - r * 0.45}
        y={cy + 6}
        fontFamily="Fraunces, Georgia, serif"
        fontSize={numeralFontSize}
        fontWeight={500}
        fill={textColor}
        textAnchor="middle"
      >
        {leftCount}
      </text>

      {/* Right numeral */}
      <text
        x={cx2 + r * 0.45}
        y={cy + 6}
        fontFamily="Fraunces, Georgia, serif"
        fontSize={numeralFontSize}
        fontWeight={500}
        fill={textColor}
        textAnchor="middle"
      >
        {rightCount}
      </text>

      {/* Shared numeral */}
      <text
        x={(cx1 + cx2) / 2}
        y={cy + 6}
        fontFamily="Fraunces, Georgia, serif"
        fontSize={sharedFontSize}
        fontWeight={600}
        fill={textColor}
        textAnchor="middle"
      >
        {sharedCount}
      </text>
    </svg>
  );
}

export { VennChart };
export type { VennChartProps };
