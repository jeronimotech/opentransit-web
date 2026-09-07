import { haversineMeters } from "./geo";
import type { Stop, Vehicle } from "./api/types";

/**
 * Line page (Lote 2 B4): put the live buses onto the stop timeline.
 *
 * A GTFS-RT vehicle reports the stop it is heading *to*, so a bus matched to stop
 * `i` is drawn on the connector just above that stop — that is where it physically
 * is. When the feed sends no `stopId` (Bogotá leaves ~11 % of trips unresolved) the
 * bus is snapped to the nearest stop of the pattern, and dropped when it is far
 * enough away that the guess would be a lie.
 */

/** Beyond this, a snapped position is not trustworthy enough to draw. */
export const SNAP_LIMIT_METERS = 700;

export type TimelinePlacement = Map<number, Vehicle[]>;

export function placeVehicles(stops: Stop[], vehicles: Vehicle[], snapLimit = SNAP_LIMIT_METERS): TimelinePlacement {
  const byId = new Map<string, number>();
  stops.forEach((s, i) => byId.set(s.id, i));
  const out: TimelinePlacement = new Map();
  const add = (i: number, v: Vehicle) => {
    const list = out.get(i);
    if (list) list.push(v);
    else out.set(i, [v]);
  };

  for (const v of vehicles) {
    const direct = v.stopId ? byId.get(v.stopId) : undefined;
    if (direct !== undefined) {
      add(direct, v);
      continue;
    }
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < stops.length; i++) {
      const d = haversineMeters({ lat: v.lat, lon: v.lon }, stops[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0 && bestD <= snapLimit) add(best, v);
  }
  return out;
}

/** Deep link into the mobile app for "GO rápido", with the web page as the fallback. */
export function goQuickLinks(city: string, stopId: string, routeId: string, origin?: string) {
  const q = `stop=${encodeURIComponent(stopId)}&route=${encodeURIComponent(routeId)}&go=1`;
  return {
    app: `opentransit://${city}/next?${q}`,
    web: `${origin ?? ""}/${city}/next?${q}`,
  };
}
