"use client";

import { useContext } from "react";
import { CityCtx } from "@/components/shell/CityContext";
import { componentOf } from "@/lib/city-config";
import { routeChipColors } from "@/lib/route-color";
import type { Component, Mode, RouteRef } from "@/lib/api/types";

const MODE_GLYPH: Partial<Record<Mode, string>> = {
  CABLE_CAR: "⛟",
  RAIL: "🚆",
  SUBWAY: "Ⓜ",
  TRAM: "🚋",
  FERRY: "⛴",
};

type Props = {
  route: (Pick<RouteRef, "shortName" | "color" | "mode"> & { textColor?: string | null; component?: Component | null }) | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
};

/**
 * Route code rendered like signage: heavy weight, route colour, high contrast.
 * The single most repeated visual in the app, so it stays quiet and consistent:
 * feed colours are blended toward the component colour and clamped to ≥ 4.5:1
 * (neon `#FF0000`-style feed colours fall back to the component colour entirely).
 */
export function RouteChip({ route, size = "md", className = "", title }: Props) {
  const city = useContext(CityCtx);
  if (!route) return null;
  const compHex = city ? componentOf(city, route.component ?? null).color : "#667085";
  const { bg, fg } = routeChipColors(route.color, compHex);
  const sz = size === "sm" ? "h-5 min-w-8 px-1.5 text-[11px]" : size === "lg" ? "h-9 min-w-14 px-3 text-lg" : "h-7 min-w-10 px-2 text-sm";
  const glyph = MODE_GLYPH[route.mode];
  return (
    <span title={title ?? route.shortName} className={`inline-flex items-center justify-center rounded-md font-extrabold tracking-tight leading-none ${sz} ${className}`} style={{ background: bg, color: fg }}>
      {glyph ? <span className="mr-1 text-[0.85em]">{glyph}</span> : null}
      {route.shortName}
    </span>
  );
}
