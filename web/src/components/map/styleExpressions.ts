import type { ExpressionSpecification } from "mapbox-gl";

/**
 * Map layer style helpers.
 *
 * Driven by three feature properties and one feature-state:
 *   `glow`    – number in [0, 1] from `conferenceGlow()` — peaks during the
 *               event, fades after, ramps in before. Drives radius + opacity
 *               so the cluster reads like a heatmap.
 *   `state`   – "default" | "mine" | "past" | "past-mine" — drives color.
 *   `premium` – boolean — when true, overrides state-based color so sponsored
 *               conferences read as a single distinct hue regardless of
 *               attendance.
 *   feature-state.hover / .active – pop-out radius + color highlight on
 *               pointer interaction.
 */

type Colors = {
  future: string;
  futureMine: string;
  past: string;
  pastMine: string;
  premium: string;
  hover: string;
  haloHover: string;
};

export function coreRadius(): ExpressionSpecification {
  return [
    "case",
    ["boolean", ["feature-state", "active"], false],
    14,
    ["boolean", ["feature-state", "hover"], false],
    14,
    [
      "interpolate",
      ["linear"],
      ["get", "glow"],
      0,
      3.5,
      1,
      9,
    ],
  ] as ExpressionSpecification;
}

export function haloRadius(): ExpressionSpecification {
  return [
    "case",
    ["boolean", ["feature-state", "active"], false],
    24,
    ["boolean", ["feature-state", "hover"], false],
    24,
    [
      "interpolate",
      ["linear"],
      ["get", "glow"],
      0,
      7,
      1,
      18,
    ],
  ] as ExpressionSpecification;
}

export function coreColor(c: Colors): ExpressionSpecification {
  return [
    "case",
    ["boolean", ["feature-state", "active"], false],
    c.hover,
    ["boolean", ["feature-state", "hover"], false],
    c.hover,
    ["==", ["get", "premium"], true],
    c.premium,
    [
      "match",
      ["get", "state"],
      "mine",
      c.futureMine,
      "past-mine",
      c.pastMine,
      "past",
      c.past,
      /* default */ c.future,
    ],
  ] as ExpressionSpecification;
}

export function haloColor(c: Colors): ExpressionSpecification {
  return [
    "case",
    ["boolean", ["feature-state", "active"], false],
    c.haloHover,
    ["boolean", ["feature-state", "hover"], false],
    c.haloHover,
    ["==", ["get", "premium"], true],
    c.premium,
    [
      "match",
      ["get", "state"],
      "mine",
      c.futureMine,
      "past-mine",
      c.pastMine,
      "past",
      c.past,
      /* default */ c.future,
    ],
  ] as ExpressionSpecification;
}

export const coreOpacity: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "glow"],
  0,
  0.35,
  1,
  1,
];

export const haloOpacity: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "glow"],
  0,
  0.08,
  1,
  0.45,
];

export type { Colors };
