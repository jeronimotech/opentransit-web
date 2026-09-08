import type { GeocodeResult } from "./api/types";
import type { PlannerPoint, PlannerState } from "./planner-params";

/**
 * Contract addendum v2.1 — origin and destination are equally reachable.
 *
 * Any geocode result (a stop, an address, a street, a POI) can fill either field,
 * a point chosen on the map is a valid endpoint even without a name, and swapping
 * works with one field empty. The rules live here so the planner page, the field
 * and the map picker all decide the same way — and so they can be tested without a DOM.
 */
export type Field = "from" | "to";

export const otherField = (f: Field): Field => (f === "from" ? "to" : "from");

/** Endpoints only, so map pickers and tests do not have to build a whole planner state. */
type Ends = { from: PlannerPoint | null; to: PlannerPoint | null };

/** One filled end is enough: swapping it empties the other, which is what the person asked for. */
export function canSwap(s: Ends): boolean {
  return !!(s.from || s.to);
}

export function swapEndpoints<S extends PlannerState>(s: S): S {
  return { ...s, from: s.to, to: s.from, selected: null };
}

/**
 * Fill one field with a chosen place. `ready` means both ends are set now, so the
 * caller runs the plan; the selected itinerary is dropped because the trip changed.
 */
export function applyEndpoint<S extends PlannerState>(s: S, field: Field, p: PlannerPoint): { next: S; ready: boolean } {
  const next = { ...s, [field]: p, selected: null } as S;
  return { next, ready: !!(next.from && next.to) };
}

/** True when filling `field` would replace a point the person already chose. */
export function replacesEndpoint(s: Ends, field: Field): boolean {
  return !!s[field];
}

/** Coordinates are the last-resort name for a point nobody could name. */
export function coordName(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/** A point echoed to the planner as `fromName`/`toName`: the reverse-geocoded name, else coordinates. */
export function pointFrom(lat: number, lon: number, name?: string | null): PlannerPoint {
  const n = (name ?? "").trim();
  return { lat, lon, name: n || coordName(lat, lon) };
}

/* ── result presentation ──────────────────────────────────────────────────── */

/** The API's `type`, reduced to the glyph a row draws. `place` = Photon neighbourhoods/localities. */
export type PlaceGlyph = GeocodeResult["type"];

const GLYPHS: PlaceGlyph[] = ["station", "stop", "address", "street", "poi", "place"];

export function placeGlyph(r: Pick<GeocodeResult, "type" | "stopId">): PlaceGlyph {
  if (GLYPHS.includes(r.type)) return r.type;
  return r.stopId ? "stop" : "place";
}

/** A stop keeps the component colour; a street, address or POI must never look like one. */
export function isTransitResult(r: Pick<GeocodeResult, "type" | "stopId" | "source">): boolean {
  return r.type === "station" || r.type === "stop" || (r.source === "gtfs" && !!r.stopId);
}

/** The second line of a result: whatever the API labelled it, else the kind of thing it is. */
export function resultSubtitle(r: Pick<GeocodeResult, "type" | "stopId" | "label">, labels: Record<PlaceGlyph, string>): string {
  return (r.label ?? "").trim() || labels[placeGlyph(r)];
}

export function toPoint(r: Pick<GeocodeResult, "lat" | "lon" | "name">): PlannerPoint {
  return pointFrom(r.lat, r.lon, r.name);
}
