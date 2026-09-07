import type { Alert, Itinerary } from "./api/types";
import type { FavPlace } from "./favorites";

/**
 * Casa ⇄ Trabajo (Citymapper playbook, Lote 2 B1).
 *
 * The card guesses the direction you are most likely to want and lets you invert it:
 * before midday it points at work, from midday on it points home. The guess is made
 * with the *city's* clock, not the browser's, so a traveller in another timezone
 * still sees the direction a local would.
 */

export type CommuteDirection = "toWork" | "toHome";

/** Hour 0..23 in the given IANA timezone. */
export function hourInTz(now: number, tz: string): number {
  try {
    const h = new Intl.DateTimeFormat("en-US", { hour: "2-digit", hour12: false, timeZone: tz }).format(new Date(now));
    const n = Number(h);
    return Number.isFinite(n) ? n % 24 : new Date(now).getHours();
  } catch {
    return new Date(now).getHours();
  }
}

/** Which way the card points before any manual inversion. `null` = not enough favourites. */
export function autoDirection(home: FavPlace | undefined, work: FavPlace | undefined, now: number, tz: string): CommuteDirection | null {
  if (!home && !work) return null;
  if (home && !work) return "toHome";
  if (work && !home) return "toWork";
  return hourInTz(now, tz) < 12 ? "toWork" : "toHome";
}

export type CommutePlan = {
  direction: CommuteDirection;
  origin: FavPlace | null; // null → "my location"
  destination: FavPlace;
};

/**
 * Resolve the card into a concrete trip. With both places saved the trip runs
 * between them; with only one, it starts wherever the person is.
 */
export function resolveCommute(
  home: FavPlace | undefined,
  work: FavPlace | undefined,
  direction: CommuteDirection,
): CommutePlan | null {
  if (direction === "toWork" && work) return { direction, origin: home ?? null, destination: work };
  if (direction === "toHome" && home) return { direction, origin: work ?? null, destination: home };
  // asked for a direction whose destination is missing → fall back to the one we have
  if (work) return { direction: "toWork", origin: home ?? null, destination: work };
  if (home) return { direction: "toHome", origin: work ?? null, destination: home };
  return null;
}

export const flipDirection = (d: CommuteDirection): CommuteDirection => (d === "toWork" ? "toHome" : "toWork");

/** The alerts that touch any route used by this itinerary (so the card can warn). */
export function alertsOnItinerary(it: Itinerary | null | undefined, alerts: Alert[] | undefined): Alert[] {
  if (!it || !alerts?.length) return [];
  const ids = new Set(it.legs.map((l) => l.route?.id).filter((x): x is string => !!x));
  if (!ids.size) return [];
  const seen = new Set<string>();
  const out: Alert[] = [];
  for (const a of alerts) {
    if (seen.has(a.id)) continue;
    if (a.routeIds.some((r) => ids.has(r))) {
      seen.add(a.id);
      out.push(a);
    }
  }
  return out;
}
