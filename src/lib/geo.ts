import polyline from "@mapbox/polyline";
import type { Feature, FeatureCollection, GeoJsonProperties, LineString, Point } from "geojson";
import type { Geometry, LatLon } from "./api/types";

export type LngLat = [number, number];
export type BBox = [number, number, number, number]; // minLon, minLat, maxLon, maxLat

/** Decode an encoded polyline into [lon, lat] pairs (GeoJSON order). */
export function decodeGeometry(g: Geometry | null | undefined): LngLat[] {
  if (!g?.encoded) return [];
  return polyline.decode(g.encoded, g.precision ?? 5).map(([lat, lon]) => [lon, lat]);
}

export function encodeGeometry(coords: LngLat[], precision = 5): Geometry {
  return {
    encoded: polyline.encode(
      coords.map(([lon, lat]) => [lat, lon]),
      precision,
    ),
    precision,
  };
}

export function bboxOf(coords: LngLat[]): BBox | null {
  if (!coords.length) return null;
  let minLon = Infinity,
    minLat = Infinity,
    maxLon = -Infinity,
    maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

export function haversineMeters(a: LatLon, b: LatLon): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function toLineString(coords: LngLat[], props: GeoJsonProperties = {}): Feature<LineString> {
  return {
    type: "Feature",
    properties: props,
    geometry: { type: "LineString", coordinates: coords },
  };
}

export function toPoint(lon: number, lat: number, props: GeoJsonProperties = {}): Feature<Point> {
  return {
    type: "Feature",
    properties: props,
    geometry: { type: "Point", coordinates: [lon, lat] },
  };
}

export function fc(features: Feature[]): FeatureCollection {
  return { type: "FeatureCollection", features };
}

/** Bearing in degrees from a to b. */
export function bearing(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x =
    Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) -
    Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Pick the readable text color for a background hex. */
export function contrastText(hex: string | null | undefined): string {
  if (!hex) return "#ffffff";
  const h = hex.replace("#", "");
  if (h.length < 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#14161a" : "#ffffff";
}

export function normalizeHex(hex: string | null | undefined, fallback = "#667085"): string {
  if (!hex) return fallback;
  const h = hex.startsWith("#") ? hex : `#${hex}`;
  return /^#[0-9a-fA-F]{6}$/.test(h) ? h : fallback;
}
