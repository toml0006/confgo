import type { ExpressionSpecification } from "mapbox-gl";

/**
 * Map layer style helpers.
 * - `glow` is a feature property in [0, 1] set client-side via conferenceGlow().
 * - `state` is one of "default" | "mine" | "past" | "past-mine".
 */

export const coreRadius: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "glow"],
  0,
  3.5,
  1,
  9,
];

export const haloRadius: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "glow"],
  0,
  7,
  1,
  18,
];

export const coreColor: ExpressionSpecification = [
  "match",
  ["get", "state"],
  "mine",
  "#5ee7d9", // signal teal
  "past-mine",
  "#8ca0dc", // past-signal muted blue
  "past",
  "#c3a0b4", // past-ember muted rose
  /* default */ "#f6d4a3", // ember warm amber
];

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
