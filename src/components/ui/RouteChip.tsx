import { contrastText, normalizeHex } from "@/lib/geo";
import type { Mode, RouteRef } from "@/lib/api/types";

const MODE_GLYPH: Partial<Record<Mode, string>> = {
  CABLE_CAR: "⛟",
  RAIL: "🚆",
  SUBWAY: "Ⓜ",
  TRAM: "🚋",
  FERRY: "⛴",
};

type Props = {
  route: Pick<RouteRef, "shortName" | "color" | "textColor" | "mode"> | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
};

/**
 * Route code rendered like signage: heavy weight, route color, high contrast.
 * The single most repeated visual in the app, so it stays quiet and consistent.
 */
export function RouteChip({ route, size = "md", className = "", title }: Props) {
  if (!route) return null;
  const bg = normalizeHex(route.color);
  const fg = route.textColor ? normalizeHex(route.textColor, contrastText(bg)) : contrastText(bg);
  const sz =
    size === "sm"
      ? "h-5 min-w-8 px-1.5 text-[11px]"
      : size === "lg"
        ? "h-9 min-w-14 px-3 text-lg"
        : "h-7 min-w-10 px-2 text-sm";
  const glyph = MODE_GLYPH[route.mode];
  return (
    <span
      title={title ?? route.shortName}
      className={`inline-flex items-center justify-center rounded-md font-extrabold tracking-tight leading-none ${sz} ${className}`}
      style={{ background: bg, color: fg }}
    >
      {glyph ? <span className="mr-1 text-[0.85em]">{glyph}</span> : null}
      {route.shortName}
    </span>
  );
}
