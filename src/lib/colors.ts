import type { Component } from "./api/types";

export const COMPONENT_COLORS: Record<Component, string> = {
  trunk: "#D32F2F",
  feeder: "#2E7D4F",
  dual: "#8E24AA",
  zonal: "#1565C0",
  cable: "#6A1B9A",
  rail: "#455A64",
  // An operator that runs several modes itself needs these: components then come from
  // the GTFS mode, not the agency.
  tram: "#0054A6",
  bus: "#D32F2F",
  other: "#667085",
};

export function componentColor(c: Component | null | undefined): string {
  return c ? COMPONENT_COLORS[c] ?? COMPONENT_COLORS.other : COMPONENT_COLORS.other;
}
