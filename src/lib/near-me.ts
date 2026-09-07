/**
 * "Cerca de mí" (contract v1.9): the live fleet reduced to one question — what is
 * moving around me right now, and should I care?
 *
 * Everything here is pure so the map, the list and the tests share one definition
 * of "nearby", "approaching" and "which bbox do we subscribe to".
 */
import { bearing, haversineMeters, type BBox, type LngLat } from "./geo";
import type { Component, LatLon, Vehicle } from "./api/types";

export const RADII = [300, 600, 1000] as const;
export type Radius = (typeof RADII)[number];
export const DEFAULT_RADIUS: Radius = 600;

export function isRadius(n: unknown): n is Radius {
  return typeof n === "number" && (RADII as readonly number[]).includes(n);
}

const METERS_PER_DEG_LAT = 111_320;

/** Metres per degree of longitude at this latitude (shrinks towards the poles). */
function metersPerDegLon(lat: number): number {
  return Math.max(1, METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
}

/**
 * The bbox enclosing the radius circle, with the centre snapped to a grid so a
 * walking user does not re-subscribe on every GPS fix. The box is padded by one
 * grid cell, so a vehicle at the true edge of the circle is still inside the box
 * even when the snapped centre sits a cell away.
 */
export function bboxForRadius(center: LatLon, radiusM: number, quantizeM = radiusM / 4): BBox {
  const q = Math.max(1, quantizeM);
  const latStep = q / METERS_PER_DEG_LAT;
  const lat = Math.round(center.lat / latStep) * latStep;
  // The longitude grid must hang off the *snapped* latitude. Deriving it from the
  // raw one makes the grid itself slide as the user walks north, so the snapped
  // longitude never settles and every GPS fix opens a new subscription.
  const lonStep = q / metersPerDegLon(lat);
  const lon = Math.round(center.lon / lonStep) * lonStep;
  const padded = radiusM + q;
  const dLat = padded / METERS_PER_DEG_LAT;
  const dLon = padded / metersPerDegLon(lat);
  return [round6(lon - dLon), round6(lat - dLat), round6(lon + dLon), round6(lat + dLat)];
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function bboxParam(b: BBox): string {
  return b.join(",");
}

/** A circle as a GeoJSON ring, for the soft radius overlay. */
export function circleRing(center: LatLon, radiusM: number, steps = 64): LngLat[] {
  const dLat = radiusM / METERS_PER_DEG_LAT;
  const dLon = radiusM / metersPerDegLon(center.lat);
  const ring: LngLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([round6(center.lon + dLon * Math.cos(a)), round6(center.lat + dLat * Math.sin(a))]);
  }
  return ring;
}

export type Motion = "approaching" | "away" | null;

/**
 * Is the bus coming towards me or going away? Compared against the bearing from
 * the bus to me, with a dead band around 90° so a bus crossing my street is not
 * labelled either way. Null whenever the frame carries no bearing — the feed does
 * not always publish one, and guessing would be worse than saying nothing.
 */
export function relativeMotion(v: Pick<Vehicle, "lat" | "lon" | "bearing">, user: LatLon): Motion {
  if (v.bearing == null || !Number.isFinite(v.bearing)) return null;
  const toUser = bearing([v.lon, v.lat], [user.lon, user.lat]);
  const diff = angleDiff(v.bearing, toUser);
  if (diff <= 70) return "approaching";
  if (diff >= 110) return "away";
  return null;
}

/** Smallest absolute angle between two bearings, 0–180. */
export function angleDiff(a: number, b: number): number {
  const d = (((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

export type NearbyVehicle = { vehicle: Vehicle; distanceMeters: number; motion: Motion };

/** Vehicles inside the radius, nearest first. Component filter is a set so "all" is an empty set. */
export function nearbyVehicles(
  vehicles: Iterable<Vehicle>,
  user: LatLon,
  radiusM: number,
  components: ReadonlySet<Component> = new Set(),
): NearbyVehicle[] {
  const out: NearbyVehicle[] = [];
  for (const v of vehicles) {
    if (components.size && !components.has(v.component as Component)) continue;
    const distanceMeters = haversineMeters(user, { lat: v.lat, lon: v.lon });
    if (distanceMeters > radiusM) continue;
    out.push({ vehicle: v, distanceMeters, motion: relativeMotion(v, user) });
  }
  out.sort((a, b) => a.distanceMeters - b.distanceMeters || a.vehicle.id.localeCompare(b.vehicle.id));
  return out;
}

/** The next radius up, or null when already at the widest — drives the empty state's one-tap widen. */
export function widerRadius(r: number): Radius | null {
  const next = RADII.find((x) => x > r);
  return next ?? null;
}

export function formatDistance(m: number): string {
  // Rounding to 10 m turns anything under 5 m into "a 0 m", which reads as broken
  // rather than as "it is right here".
  if (m < 10) return "a menos de 10 m";
  return m < 1000 ? `a ${Math.round(m / 10) * 10} m` : `a ${(m / 1000).toFixed(1)} km`;
}

// ── persistence ─────────────────────────────────────────────────────────────
// Per city, same convention as favorites: opentransit.<city>.<thing>

export type NearMePrefs = { radius: Radius; components: Component[] };

const prefsKey = (city: string) => `opentransit.${city}.nearme`;

export function readPrefs(city: string): NearMePrefs {
  const fallback: NearMePrefs = { radius: DEFAULT_RADIUS, components: [] };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(prefsKey(city));
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<NearMePrefs>;
    return {
      radius: isRadius(p.radius) ? p.radius : DEFAULT_RADIUS,
      components: Array.isArray(p.components) ? (p.components.filter((c) => typeof c === "string") as Component[]) : [],
    };
  } catch {
    return fallback;
  }
}

export function writePrefs(city: string, p: NearMePrefs): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(prefsKey(city), JSON.stringify({ radius: p.radius, components: p.components }));
  } catch {
    /* private mode / quota — the mode still works, it just forgets */
  }
}
