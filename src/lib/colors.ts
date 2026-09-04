import type { Component } from "./api/types";

export const COMPONENT_COLORS: Record<Component, string> = {
  trunk: "#D32F2F",
  feeder: "#2E7D4F",
  dual: "#8E24AA",
  zonal: "#1565C0",
  cable: "#6A1B9A",
  rail: "#455A64",
  other: "#667085",
};

export function componentColor(c: Component | null | undefined): string {
  return c ? COMPONENT_COLORS[c] ?? COMPONENT_COLORS.other : COMPONENT_COLORS.other;
}
