/**
 * Mock request router for NEXT_PUBLIC_MOCK=1. Mirrors the API contract paths.
 */
import { ApiRequestError } from "@/lib/api/client";
import { encodeGeometry, haversineMeters } from "@/lib/geo";
import { toIsoWithOffset } from "@/lib/format";
import type {
  Departure,
  GeocodeResult,
  Place,
  StopDetail,
  VehicleDetail,
  VehicleEvent,
  VehicleFrame,
} from "@/lib/api/types";
import {
  TZ,
  alerts,
  buildItineraries,
  city,
  corridorFor,
  corridors,
  currentVehicles,
  routeById,
  routes,
  shapes,
  stopById,
  stops,
  tickVehicles,
  vehicleTrail,
} from "./data";

type Q = Record<string, string | number | boolean | undefined | null>;
const iso = (d: Date) => toIsoWithOffset(d, TZ);
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const num = (q: Q, k: string, d = 0) => (q[k] === undefined || q[k] === null ? d : Number(q[k]));
const str = (q: Q, k: string) => (q[k] === undefined || q[k] === null ? "" : String(q[k]));

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

let seq = 1;
function frame(): VehicleFrame {
  const vehicles = currentVehicles();
  return {
    type: "full",
    seq: seq++,
    generatedAt: iso(new Date()),
    feedTimestamp: iso(new Date(Date.now() - 12_000)),
    count: vehicles.length,
    health: { entityAgeP50Seconds: 18, pctTripResolved: 88.9, httpStatus: 200 },
    vehicles,
  };
}

const POIS: GeocodeResult[] = [
  { id: "photon:1", name: "Aeropuerto El Dorado", label: "Aeropuerto · Fontibón", lat: 4.7016, lon: -74.1469, type: "poi", stopId: null, component: null, source: "photon" },
  { id: "photon:2", name: "Universidad Nacional", label: "Universidad · Teusaquillo", lat: 4.6363, lon: -74.0836, type: "poi", stopId: null, component: null, source: "photon" },
  { id: "photon:3", name: "Plaza de Bolívar", label: "Plaza · La Candelaria", lat: 4.5981, lon: -74.0758, type: "poi", stopId: null, component: null, source: "photon" },
  { id: "photon:4", name: "Calle 26 # 13-19", label: "Dirección · Santa Fe", lat: 4.6122, lon: -74.0712, type: "address", stopId: null, component: null, source: "photon" },
  { id: "photon:5", name: "Parque Simón Bolívar", label: "Parque · Teusaquillo", lat: 4.6581, lon: -74.0936, type: "poi", stopId: null, component: null, source: "photon" },
  { id: "photon:6", name: "Monserrate", label: "Cerro · La Candelaria", lat: 4.6056, lon: -74.0561, type: "poi", stopId: null, component: null, source: "photon" },
  { id: "photon:7", name: "Centro Comercial Andino", label: "Centro comercial · Chapinero", lat: 4.6672, lon: -74.0533, type: "poi", stopId: null, component: null, source: "photon" },
  { id: "photon:8", name: "Unicentro", label: "Centro comercial · Usaquén", lat: 4.7027, lon: -74.0413, type: "poi", stopId: null, component: null, source: "photon" },
];

function geocode(q: string, limit: number): GeocodeResult[] {
  const n = normalize(q);
  const fromStops: GeocodeResult[] = stops
    .filter((s) => normalize(s.name).includes(n))
    .sort((a, b) => (a.locationType === "station" ? -1 : 1) - (b.locationType === "station" ? -1 : 1))
    .map((s) => ({
      id: `stop:${s.id}`,
      name: s.name,
      label:
        s.locationType === "station"
          ? `Estación ${s.component === "cable" ? "TransMiCable" : "troncal"}`
          : `Paradero SITP · ${s.code}`,
      lat: s.lat,
      lon: s.lon,
      type: s.locationType === "station" ? "station" : "stop",
      stopId: s.id,
      component: s.component,
      source: "gtfs",
    }));
  const fromPois = POIS.filter((p) => normalize(p.name).includes(n));
  return [...fromStops, ...fromPois].slice(0, limit);
}

function departures(stopId: string, limit: number): Departure[] {
  const { routes: rs, headsigns } = corridorFor(stopId);
  const out: Departure[] = [];
  const base = Date.now();
  let k = 0;
  for (let m = 1; out.length < limit; m += 2 + (k % 3)) {
    const r = rs[k % rs.length];
    const sched = new Date(base + m * 60000);
    const live = k === 0;
    const d = live ? 90 : null;
    out.push({
      route: r,
      headsign: headsigns[k % headsigns.length],
      tripId: `bogota:${r.shortName}-${k}`,
      scheduledTime: iso(sched),
      realtimeTime: live ? iso(new Date(sched.getTime() + d! * 1000)) : null,
      realtime: live,
      delaySeconds: d,
      canceled: k === 5,
      vehicleId: live ? "V1003" : null,
      stopSequence: 12 + k,
    });
    k++;
  }
  return out;
}

function placeFor(lat: number, lon: number): Place {
  let best = stops[0],
    bd = Infinity;
  for (const s of stops) {
    const d = haversineMeters({ lat, lon }, s);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return {
    name: bd < 120 ? best.name : `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    lat,
    lon,
    stopId: bd < 120 ? best.id : null,
    stopCode: bd < 120 ? best.code : null,
    arrival: null,
    departure: null,
    component: bd < 120 ? best.component : null,
  };
}

export async function mockRequest<T>(path: string, q: Q): Promise<T> {
  await delay(120 + Math.random() * 200);
  const p = path.replace(/^\/v1\/cities\/[^/]+/, "");
  const cityId = path.match(/^\/v1\/cities\/([^/]+)/)?.[1];
  if (cityId && cityId !== "bogota") {
    throw new ApiRequestError(404, "CITY_NOT_FOUND", `No city with id ${cityId}`);
  }

  if (path === "/healthz") return { status: "ok", version: "0.1.0-mock", cities: ["bogota"] } as T;
  if (path === "/v1/cities") return { cities: [city] } as T;
  if (p === "") return city as T;

  if (p === "/plan") {
    await delay(500);
    const from = placeFor(num(q, "fromLat"), num(q, "fromLon"));
    const to = placeFor(num(q, "toLat"), num(q, "toLon"));
    const time = q.time ? new Date(String(q.time)) : new Date();
    const itineraries = buildItineraries(from, to, time, q.arriveBy === true || q.arriveBy === "true");
    return {
      from,
      to,
      itineraries,
      router: { engine: "otp", version: "2.10.0", realtime: true },
      warnings: [],
    } as T;
  }
  if (p === "/geocode") return { results: geocode(str(q, "q"), num(q, "limit", 8)) } as T;
  if (p === "/reverse") {
    const pl = placeFor(num(q, "lat"), num(q, "lon"));
    return { name: pl.stopId ? pl.name : "Calle 26 # 13-19", lat: pl.lat, lon: pl.lon } as T;
  }

  if (p === "/stops/nearby") {
    const lat = num(q, "lat"),
      lon = num(q, "lon"),
      radius = num(q, "radius", 500);
    const out = stops
      .map((s) => ({ ...s, distanceMeters: Math.round(haversineMeters({ lat, lon }, s)) }))
      .filter((s) => s.distanceMeters <= radius)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, num(q, "limit", 30));
    return { stops: out } as T;
  }
  let m = p.match(/^\/stops\/([^/]+)\/departures$/);
  if (m) {
    const s = stopById.get(decodeURIComponent(m[1]));
    if (!s) throw new ApiRequestError(404, "STOP_NOT_FOUND", "Stop not found");
    return { stop: s, generatedAt: iso(new Date()), departures: departures(s.id, num(q, "limit", 20)) } as T;
  }
  m = p.match(/^\/stops\/([^/]+)$/);
  if (m) {
    const s = stopById.get(decodeURIComponent(m[1]));
    if (!s) throw new ApiRequestError(404, "STOP_NOT_FOUND", "Stop not found");
    const detail: StopDetail = { ...s, routes: corridorFor(s.id).routes, parentStation: null, children: [] };
    return detail as T;
  }

  if (p === "/routes") {
    const comp = str(q, "component");
    const qq = normalize(str(q, "q"));
    return {
      routes: routes.filter(
        (r) => (!comp || r.component === comp) && (!qq || normalize(`${r.shortName} ${r.longName}`).includes(qq)),
      ),
    } as T;
  }
  m = p.match(/^\/routes\/([^/]+)$/);
  if (m) {
    const r = routeById.get(decodeURIComponent(m[1]));
    if (!r) throw new ApiRequestError(404, "ROUTE_NOT_FOUND", "Route not found");
    const sh = shapes.find((s) => s.routeId === r.id) ?? shapes[0];
    const corridorStops = (
      r.component === "zonal" ? corridors.ZONAL : r.component === "cable" ? corridors.CABLE : r.id.endsWith("G43") ? corridors.NQS : [...corridors.NORTE, ...corridors.NQS]
    ).map((s) => stopById.get(`bogota:${s[0]}`)!);
    const [a, b] = r.longName.split(" – ");
    return {
      ...r,
      patterns: [
        { id: `${r.id}:0`, headsign: b ?? "Ida", directionId: 0, geometry: encodeGeometry(sh.coords), stops: corridorStops },
        { id: `${r.id}:1`, headsign: a ?? "Vuelta", directionId: 1, geometry: encodeGeometry([...sh.coords].reverse()), stops: [...corridorStops].reverse() },
      ],
      alerts: alerts.filter((al) => al.routeIds.includes(r.id)),
    } as T;
  }
  if (p === "/network") {
    return {
      feedVersion: "GTFS_20260904",
      shapes: shapes.map((s) => ({ id: s.id, routeId: s.routeId, component: s.component, color: s.color, geometry: encodeGeometry(s.coords) })),
    } as T;
  }

  if (p === "/vehicles") {
    const f = frame();
    const routeId = str(q, "routeId"),
      comp = str(q, "component");
    f.vehicles = f.vehicles.filter((v) => (!routeId || v.routeId === routeId) && (!comp || v.component === comp));
    f.count = f.vehicles.length;
    return f as T;
  }
  m = p.match(/^\/vehicles\/([^/]+)$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    const v = currentVehicles().find((x) => x.id === id);
    if (!v) throw new ApiRequestError(404, "VEHICLE_NOT_FOUND", "Vehicle not in the current frame");
    const r = v.routeId ? routeById.get(v.routeId) ?? null : null;
    const sh = shapes.find((s) => s.routeId === v.routeId);
    const near = stops
      .map((s) => ({ s, d: haversineMeters(v, s) }))
      .sort((a, b) => a.d - b.d);
    const detail: VehicleDetail = {
      ...v,
      route: r,
      trip: { id: v.tripId, resolved: v.tripResolved, headsign: r ? r.longName.split(" – ")[1] ?? null : null },
      shape: sh ? encodeGeometry(sh.coords) : null,
      currentStop: near[0]?.s ?? null,
      nextStop: near[1]?.s ?? null,
      etaSeconds: 240,
      delaySeconds: v.tripResolved ? 75 : null,
      history: { points: vehicleTrail(v.id), avgKmh: 23.4 },
      alerts: alerts.filter((a) => v.routeId && a.routeIds.includes(v.routeId)),
    };
    return detail as T;
  }

  if (p === "/alerts") {
    const routeId = str(q, "routeId"),
      stopId = str(q, "stopId");
    return {
      alerts: alerts.filter(
        (a) => (!routeId || a.routeIds.includes(routeId)) && (!stopId || a.stopIds.includes(stopId)),
      ),
    } as T;
  }
  if (p === "/health") {
    return {
      static: { feedVersion: "GTFS_20260904", fetchedAt: iso(new Date(Date.now() - 3600_000)), routes: 1024, stops: 8309 },
      realtime: { lastFetchAt: iso(new Date()), entityAgeP50Seconds: 18, vehicles: 220, pctTripResolved: 88.9, alerts: 3 },
      router: { up: true, version: "2.10.0", graphBuiltAt: iso(new Date(Date.now() - 86400_000)) },
    } as T;
  }

  throw new ApiRequestError(404, "NOT_FOUND", `No mock for ${path}`);
}

/** Emits a full frame, then deltas every 4 s. Returns a stop function. */
export function mockVehicleStream(_city: string, push: (ev: VehicleEvent) => void): () => void {
  push(frame());
  const timer = setInterval(() => {
    const updated = tickVehicles();
    push({
      type: "delta",
      seq: seq++,
      generatedAt: iso(new Date()),
      feedTimestamp: iso(new Date(Date.now() - 12_000)),
      count: currentVehicles().length,
      health: { entityAgeP50Seconds: 15 + Math.floor(Math.random() * 10), pctTripResolved: 88.9, httpStatus: 200 },
      updated,
      removed: [],
    });
  }, 4000);
  return () => clearInterval(timer);
}
