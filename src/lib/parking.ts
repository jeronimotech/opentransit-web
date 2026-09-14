import type { City, CurbZone, Itinerary, Leg, ParkingInfo } from "./api/types";

/**
 * v1.6 — paid on-street parking (CDS curb zones) and park & ride. Pure helpers shared by the map
 * layer, the planner toggle and the itinerary views, so the gating and the colour rules are tested.
 */

/** The city publishes curb zones (Bogotá: the ZPP zones mirrored from PIM). */
export function curbsEnabled(city: City | null | undefined): boolean {
  return !!city?.openMobility?.cds?.enabled;
}

/** Park & ride is offered only where curbs exist AND the city turned the feature on. */
export function parkRideEnabled(city: City | null | undefined): boolean {
  return curbsEnabled(city) && !!city?.openMobility?.parkRide?.enabled;
}

export type ParkingTone = "ok" | "low" | "full" | "unknown" | "closed";

/**
 * How a zone should read on the map and in a card. `closed` beats everything (you may not park now),
 * then the free-space count: none → full, under a fifth of the total or fewer than three → low.
 */
export function parkingTone(z: Pick<CurbZone, "availableSpaces" | "totalSpaces" | "allowed">): ParkingTone {
  if (z.allowed === false) return "closed";
  const n = z.availableSpaces;
  if (n == null) return "unknown";
  if (n <= 0) return "full";
  const total = z.totalSpaces ?? 0;
  if (n < 3 || (total > 0 && n / total < 0.2)) return "low";
  return "ok";
}

export const PARKING_COLORS: Record<ParkingTone, string> = {
  ok: "#2e7d4f",
  low: "#c77700",
  full: "#b42318",
  unknown: "#667085",
  closed: "#98a2b3",
};

/** Seconds since the zone's count was last true, or null when it never said. */
export function availabilityAgeSeconds(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.round((now - t) / 1000)) : null;
}

/** The car leg of a park & ride itinerary, if any. */
export function parkRideLeg(it: Pick<Itinerary, "legs">): Leg | null {
  return it.legs.find((l) => l.parkRide) ?? null;
}

export function isParkRide(it: Pick<Itinerary, "legs" | "parking" | "source">): boolean {
  return !!it.parking || it.source === "parkride" || it.legs.some((l) => l.parkRide);
}

/** "Und1414 · 29 de 44 cupos" — the one line a card has room for. */
export function parkingSummary(p: Pick<ParkingInfo, "name" | "availableSpaces" | "totalSpaces">, lang: "es" | "en"): string {
  const name = p.name ?? (lang === "es" ? "Parqueo" : "Parking");
  if (p.availableSpaces == null) return name;
  const spaces = p.totalSpaces != null ? `${p.availableSpaces} ${lang === "es" ? "de" : "of"} ${p.totalSpaces}` : String(p.availableSpaces);
  return `${name} · ${spaces} ${lang === "es" ? "cupos" : "spaces"}`;
}
