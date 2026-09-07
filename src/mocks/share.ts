/**
 * In-memory shared-ETA store for NEXT_PUBLIC_MOCK=1.
 *
 * Mirrors the v1.7 contract: create returns a token plus a one-time write key,
 * reads are public, and patch/revoke require the key. One token is pre-seeded so
 * `/bogota/eta/demo` works in screenshots and manual testing without creating one.
 */
import { ApiRequestError } from "@/lib/api/client";
import type { Itinerary, ShareCreated, SharedEta, ShareProgress } from "@/lib/api/types";

type Row = { token: string; writeKey: string; label: string | null; itinerary: Itinerary; progress: ShareProgress | null; updatedAt: string; expiresAt: string };

const rows = new Map<string, Row>();
const TTL_MIN = 180;

const iso = (d: Date) => d.toISOString();
const token = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2, 10);

export function shareCreate(city: string, body: { itinerary: Itinerary; startedAt?: string; label?: string }): ShareCreated {
  const t = token();
  const writeKey = token();
  const expiresAt = iso(new Date(Date.now() + TTL_MIN * 60_000));
  rows.set(t, { token: t, writeKey, label: body.label ?? null, itinerary: body.itinerary, progress: null, updatedAt: iso(new Date()), expiresAt });
  return { token: t, url: `${typeof location !== "undefined" ? location.origin : ""}/${city}/eta/${t}`, expiresAt, writeKey };
}

/** The demo trip: seeded lazily so it always starts "now" relative to the reader. */
function seedDemo(itinerary: Itinerary): Row {
  const now = Date.now();
  const legs = itinerary.legs;
  const idx = Math.min(1, Math.max(0, legs.length - 1));
  const row: Row = {
    token: "demo",
    writeKey: "demo-key",
    label: "Chicó Norte → Portal Sur",
    itinerary,
    progress: { legIndex: idx, atStopId: legs[idx]?.from.stopId ?? null, lat: legs[idx]?.from.lat ?? null, lon: legs[idx]?.from.lon ?? null, etaAt: itinerary.endTime, state: "on_time" },
    updatedAt: iso(new Date(now - 25_000)),
    expiresAt: iso(new Date(now + 90 * 60_000)),
  };
  rows.set("demo", row);
  return row;
}

export function shareRead(t: string, demoItinerary: () => Itinerary): SharedEta {
  let row = rows.get(t);
  if (!row && t === "demo") row = seedDemo(demoItinerary());
  if (!row) throw new ApiRequestError(404, "SHARE_NOT_FOUND", `No shared trip ${t}`);
  if (Date.parse(row.expiresAt) <= Date.now()) throw new ApiRequestError(404, "SHARE_EXPIRED", "This shared trip has expired");
  return {
    label: row.label,
    itinerary: row.itinerary,
    progress: row.progress,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt,
    city: { id: "bogota", name: "Bogotá", timezone: "America/Bogota", center: { lat: 4.6534, lon: -74.0836 }, defaultZoom: 12, attribution: "Datos: TRANSMILENIO S.A. (GTFS)", branding: { primaryColor: "#D32F2F", logoUrl: null } },
  };
}

export function sharePatch(t: string, key: string, progress: ShareProgress, demoItinerary: () => Itinerary): SharedEta {
  const row = rows.get(t);
  if (!row) throw new ApiRequestError(404, "SHARE_NOT_FOUND", `No shared trip ${t}`);
  if (row.writeKey !== key) throw new ApiRequestError(403, "FORBIDDEN", "Wrong share key");
  row.progress = progress;
  row.updatedAt = iso(new Date());
  return shareRead(t, demoItinerary);
}

export function shareRevoke(t: string, key: string): null {
  const row = rows.get(t);
  if (!row) throw new ApiRequestError(404, "SHARE_NOT_FOUND", `No shared trip ${t}`);
  if (row.writeKey !== key) throw new ApiRequestError(403, "FORBIDDEN", "Wrong share key");
  row.progress = { legIndex: row.progress?.legIndex ?? 0, etaAt: row.itinerary.endTime, state: "cancelled" };
  row.updatedAt = iso(new Date());
  return null;
}
