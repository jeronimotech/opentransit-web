/**
 * Mock request router for NEXT_PUBLIC_MOCK=1. Mirrors the API contract paths.
 */
import { ApiRequestError } from "@/lib/api/client";
import { encodeGeometry, haversineMeters } from "@/lib/geo";
import { toIsoWithOffset } from "@/lib/format";
import type {
  BoardResponse,
  Departure,
  Freshness,
  ForecastOption,
  ForecastResponse,
  GeocodeResult,
  NearbyRentalStation,
  NextResponse,
  OnDemandEstimateResponse,
  OnDemandHandoffResponse,
  Place,
  ShareProgress,
  RentalNetworkInfo,
  RentalStationDetail,
  StopDetail,
  VehicleDetail,
  VehicleEvent,
  VehicleFrame,
} from "@/lib/api/types";
import {
  TZ,
  alerts,
  buildItineraries,
  buildOnDemandItineraries,
  buildRentalItineraries,
  corridorFor,
  corridors,
  currentVehicles,
  mockTaxiPrice,
  modeFlags,
  onDemandProviders,
  pois,
  rentalStationById,
  rentalStations,
  routeById,
  routes,
  shapes,
  stopById,
  stops,
  tembici,
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

/** The public city, with any admin overrides made in this session applied. */
async function liveCity() {
  const { publicCity } = await import("./admin");
  return publicCity();
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

/**
 * Photon rows, shaped like the ones the API actually returns (checked against
 * `GET /v1/cities/bogota/geocode`, 2026-09-07): the label is
 * `street, housenumber, district, city`, `component` is always null, and the id is
 * `photon:<osm_type><osm_id>`. Streets and `place` rows belong here too — the planner
 * has to tell them apart from stops, so the demo must be able to produce them.
 */
const POIS: GeocodeResult[] = [
  { id: "photon:N1", name: "Aeropuerto El Dorado", label: "Localidad Fontibón, Bogotá", lat: 4.7016, lon: -74.1469, type: "poi", stopId: null, component: null, source: "photon" },
  { id: "photon:N2", name: "Universidad Nacional", label: "Localidad Teusaquillo, Bogotá", lat: 4.6363, lon: -74.0836, type: "poi", stopId: null, component: null, source: "photon" },
  { id: "photon:N3", name: "Plaza de Bolívar", label: "Localidad La Candelaria, Bogotá", lat: 4.5981, lon: -74.0758, type: "poi", stopId: null, component: null, source: "photon" },
  { id: "photon:N4", name: "Calle 26 # 13-19", label: "Calle 26, 13-19, Localidad Santa Fe, Bogotá", lat: 4.6122, lon: -74.0712, type: "address", stopId: null, component: null, source: "photon" },
  { id: "photon:N5", name: "Parque Simón Bolívar", label: "Localidad Teusaquillo, Bogotá", lat: 4.6581, lon: -74.0936, type: "poi", stopId: null, component: null, source: "photon" },
  { id: "photon:N6", name: "Monserrate", label: "Localidad La Candelaria, Bogotá", lat: 4.6056, lon: -74.0561, type: "poi", stopId: null, component: null, source: "photon" },
  { id: "photon:N7", name: "Centro Comercial Andino", label: "Localidad Chapinero, Bogotá", lat: 4.6672, lon: -74.0533, type: "poi", stopId: null, component: null, source: "photon" },
  { id: "photon:N8", name: "Unicentro", label: "Localidad Usaquén, Bogotá", lat: 4.7027, lon: -74.0413, type: "poi", stopId: null, component: null, source: "photon" },
  { id: "photon:W9", name: "Calle 26", label: "Localidad Teusaquillo, Bogotá", lat: 4.6286, lon: -74.0865, type: "street", stopId: null, component: null, source: "photon" },
  { id: "photon:W10", name: "Carrera 7", label: "Localidad Chapinero, Bogotá", lat: 4.6488, lon: -74.0589, type: "street", stopId: null, component: null, source: "photon" },
  { id: "photon:W11", name: "Calle 85", label: "Localidad Barrios Unidos, Bogotá", lat: 4.6719, lon: -74.0554, type: "street", stopId: null, component: null, source: "photon" },
  { id: "photon:R12", name: "Chapinero", label: "Bogotá", lat: 4.6486, lon: -74.0628, type: "place", stopId: null, component: null, source: "photon" },
];

function geocode(q: string, limit: number, near?: { lat: number; lon: number }): GeocodeResult[] {
  const n = normalize(q);
  const dist = (s: { lat: number; lon: number }) => (near ? haversineMeters(near, s) : Infinity);
  const fromStops: GeocodeResult[] = stops
    .filter((s) => normalize(s.name).includes(n))
    .sort((a, b) => {
      // nearby-first: stops within 800 m rank first, then stations, then the rest
      const na = dist(a) <= 800 ? 0 : 1,
        nb = dist(b) <= 800 ? 0 : 1;
      if (na !== nb) return na - nb;
      if (na === 0) return dist(a) - dist(b);
      return (a.locationType === "station" ? -1 : 1) - (b.locationType === "station" ? -1 : 1);
    })
    .map((s) => ({
      id: `stop:${s.id}`,
      // the API builds this as `Estación|Parada · <code> · <component>`, each part optional
      name: s.name,
      label: [s.locationType === "station" ? "Estación" : "Parada", s.code, s.component].filter(Boolean).join(" · "),
      lat: s.lat,
      lon: s.lon,
      type: s.locationType === "station" ? "station" : "stop",
      stopId: s.id,
      component: s.component,
      source: "gtfs",
    }));
  const fromPois = POIS.filter((p) => normalize(p.name).includes(n));
  // `distanceMeters` only comes back when the caller passed a position, as in the API
  return [...fromStops, ...fromPois]
    .slice(0, limit)
    .map((r) => (near ? { ...r, distanceMeters: Math.round(haversineMeters(near, r)) } : r));
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

type Init = { method: string; body: string | null; headers: Record<string, string> };

export async function mockRequest<T>(path: string, q: Q, init: Init = { method: "GET", body: null, headers: {} }): Promise<T> {
  await delay(120 + Math.random() * 200);
  if (/\/analytics\/[a-z.]+$/.test(path) || /^\/v1\/cities\/[^/]+\/events$/.test(path)) {
    const { analyticsMock } = await import("./analytics");
    if (path.startsWith("/v1/admin/")) {
      const { requireAdmin } = await import("./admin");
      requireAdmin(init.headers);
    }
    return analyticsMock<T>(path, q, init);
  }
  if (path.startsWith("/v1/admin/")) {
    const { adminMock } = await import("./admin");
    return adminMock<T>(path, q, init);
  }
  const p = path.replace(/^\/v1\/cities\/[^/]+/, "");
  const cityId = path.match(/^\/v1\/cities\/([^/]+)/)?.[1];
  if (cityId && cityId !== "bogota") {
    throw new ApiRequestError(404, "CITY_NOT_FOUND", `No city with id ${cityId}`);
  }

  if (path === "/healthz") return { status: "ok", version: "0.1.0-mock", cities: ["bogota"] } as T;
  if (path === "/v1/cities") return { cities: [await liveCity()] } as T;
  if (p === "") return (await liveCity()) as T;

  if (p === "/plan") {
    await delay(500);
    const from = placeFor(num(q, "fromLat"), num(q, "fromLon"));
    const to = placeFor(num(q, "toLat"), num(q, "toLon"));
    if (q.fromName && !from.stopId) from.name = String(q.fromName);
    if (q.toName && !to.stopId) to.name = String(q.toName);
    const time = q.time ? new Date(String(q.time)) : new Date();
    const arriveBy = q.arriveBy === true || q.arriveBy === "true";
    const flags = modeFlags(str(q, "modes"));
    const onDemand = q.onDemand === true || q.onDemand === "true" || q.onDemand === "1";
    const c = await liveCity();
    const odOn = onDemand && c.features.onDemand !== false && (c.mobility?.onDemand ?? []).some((p) => p.enabled);
    const itineraries = [
      ...(flags.transit ? buildItineraries(from, to, time, arriveBy) : []),
      ...(flags.rental ? buildRentalItineraries(from, to, time, arriveBy, flags.transit) : []),
      ...(odOn ? buildOnDemandItineraries(from, to, time, arriveBy, flags.transit) : []),
    ];
    return {
      from,
      to,
      itineraries,
      router: { engine: "otp", version: "2.10.0", realtime: true },
      warnings: [],
    } as T;
  }
  /** v1.7 — "Cuándo salir": the same trip planned across the window, one row per departure. */
  if (p === "/plan/forecast") {
    await delay(420);
    const from = placeFor(num(q, "fromLat"), num(q, "fromLon"));
    const to = placeFor(num(q, "toLat"), num(q, "toLon"));
    const win = num(q, "windowMinutes", 90);
    const maxOptions = num(q, "maxOptions", 8);
    const base = new Date();
    const options: ForecastOption[] = [];
    const seen = new Set<string>();
    // walk the window in 11-minute steps, keep the first itinerary of each plan
    for (let m = 2; m < win && options.length < maxOptions; m += 11) {
      const at = new Date(base.getTime() + m * 60_000);
      const it = buildItineraries(from, to, at, false)[0];
      if (!it) continue;
      const sig = it.legs.map((l) => `${l.route?.id ?? l.mode}@${l.startTime}`).join("|");
      if (seen.has(sig)) continue;
      seen.add(sig);
      options.push({
        departAt: it.startTime,
        arriveAt: it.endTime,
        durationSeconds: it.durationSeconds,
        transfers: it.transfers,
        walkMeters: Math.round(it.walkDistanceMeters),
        modesUsed: it.modesUsed ?? [],
        routeIds: it.legs.map((l) => l.route?.id).filter((x): x is string => !!x),
        fare: it.fare,
        realtime: it.legs.some((l) => l.realtime),
        recommended: false,
        gapAfterSeconds: null,
      });
    }
    options.sort((a, b) => Date.parse(a.departAt) - Date.parse(b.departAt));
    // a believable service gap before the last option, so the panel shows the callout
    if (options.length >= 3) {
      const gapAt = options.length - 2;
      const push = 26 * 60_000;
      for (let i = gapAt + 1; i < options.length; i++) {
        options[i] = { ...options[i], departAt: iso(new Date(Date.parse(options[i].departAt) + push)), arriveAt: iso(new Date(Date.parse(options[i].arriveAt) + push)) };
      }
    }
    for (let i = 0; i < options.length - 1; i++) {
      options[i].gapAfterSeconds = Math.round((Date.parse(options[i + 1].departAt) - Date.parse(options[i].departAt)) / 1000);
    }
    // recommend the earliest arrival
    let best = 0;
    options.forEach((o, i) => {
      if (Date.parse(o.arriveAt) < Date.parse(options[best].arriveAt)) best = i;
    });
    if (options[best]) options[best].recommended = true;
    const last = options[options.length - 1];
    const gapRow = options.find((o) => (o.gapAfterSeconds ?? 0) >= 20 * 60);
    const notes: ForecastResponse["notes"] = [
      ...(gapRow ? [{ kind: "long_gap" as const, at: gapRow.departAt, text: "Intervalo largo entre salidas" }] : []),
      ...(last ? [{ kind: "last_service" as const, at: last.departAt, text: "Última salida en esta ventana" }] : []),
    ];
    return { from, to, generatedAt: iso(new Date()), options, notes } as T;
  }

  /** v1.7 — shared ETA: create, read, patch progress, revoke. */
  if (p === "/share/eta" && init.method === "POST") {
    const { shareCreate } = await import("./share");
    const body = init.body ? JSON.parse(init.body) : {};
    return shareCreate(cityId ?? "bogota", body) as T;
  }
  {
    const sm = p.match(/^\/share\/eta\/([^/]+)$/);
    if (sm) {
      const tok = decodeURIComponent(sm[1]);
      const demo = () => {
        const from = placeFor(4.6845, -74.053);
        const to = placeFor(4.5978, -74.1616);
        return buildItineraries(from, to, new Date(Date.now() - 12 * 60_000), false)[0];
      };
      const { shareRead, sharePatch, shareRevoke } = await import("./share");
      const key = init.headers["X-Share-Key"] ?? init.headers["x-share-key"] ?? "";
      if (init.method === "PATCH") {
        const body = init.body ? (JSON.parse(init.body) as { progress: ShareProgress }) : { progress: null as unknown as ShareProgress };
        return sharePatch(tok, key, body.progress, demo) as T;
      }
      if (init.method === "DELETE") return shareRevoke(tok, key) as T;
      return shareRead(tok, demo) as T;
    }
  }

  if (p === "/geocode") {
    const near = q.lat != null && q.lon != null && q.lat !== "" ? { lat: num(q, "lat"), lon: num(q, "lon") } : undefined;
    return { results: geocode(str(q, "q"), num(q, "limit", 8), near) } as T;
  }
  if (p === "/reverse") {
    const pl = placeFor(num(q, "lat"), num(q, "lon"));
    return { name: pl.stopId ? pl.name : "Calle 26 # 13-19", lat: pl.lat, lon: pl.lon } as T;
  }

  let m: RegExpMatchArray | null;
  if (p === "/stops/nearby") {
    const lat = num(q, "lat"),
      lon = num(q, "lon"),
      radius = num(q, "radius", 500);
    const out = stops
      .map((s) => ({ ...s, distanceMeters: Math.round(haversineMeters({ lat, lon }, s)) }))
      .filter((s) => s.distanceMeters <= radius)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, num(q, "limit", 30));
    const include = str(q, "include").split(",").filter(Boolean);
    const rental: NearbyRentalStation[] = include.includes("rental")
      ? rentalStations
          .map((s) => ({ ...s, kind: "rental_station" as const, distanceMeters: Math.round(haversineMeters({ lat, lon }, s)) }))
          .filter((s) => s.distanceMeters <= Math.max(radius, 900))
          .sort((a, b) => a.distanceMeters - b.distanceMeters)
          .slice(0, 5)
      : [];
    return { stops: include.length && !include.includes("stops") ? [] : out, ...(include.includes("rental") ? { rental } : {}) } as T;
  }

  // ── v1.2 shared bikes (GBFS) ──
  const networkInfo = (): RentalNetworkInfo => ({
    ...tembici,
    systemId: "bogota_bike",
    timezone: TZ,
    stations: rentalStations.length,
    vehicleTypes: [
      { id: "FIT", formFactor: "bicycle", propulsion: "human", name: "Bicicleta" },
      { id: "EFIT", formFactor: "bicycle", propulsion: "electric_assist", name: "Bicicleta eléctrica" },
    ],
    pricingPlans: [
      { id: "daily", name: "Pase diario", price: 11000, currency: "COP", description: "Viajes de hasta 45 min durante 24 h", isTaxable: false },
      { id: "monthly", name: "Mensual", price: 31990, currency: "COP", description: "Viajes de hasta 45 min durante 30 días", isTaxable: false },
    ],
    lastFetchAt: iso(new Date(Date.now() - 12_000)),
    up: true,
  });
  if (p === "/rental/networks") return { networks: [networkInfo()] } as T;
  if (p === "/rental/stations") {
    const bbox = str(q, "bbox").split(",").map(Number);
    const net = str(q, "networkId");
    const out = rentalStations.filter((st) => {
      const inBox = bbox.length === 4 && bbox.every(Number.isFinite) ? st.lon >= bbox[0] && st.lon <= bbox[2] && st.lat >= bbox[1] && st.lat <= bbox[3] : true;
      return inBox && (!net || st.networkId === net);
    });
    return { generatedAt: iso(new Date()), ttlSeconds: 30, stations: out.slice(0, num(q, "limit", 500)) } as T;
  }
  m = p.match(/^\/rental\/stations\/([^/]+)$/);
  if (m) {
    const st = rentalStationById.get(decodeURIComponent(m[1]));
    if (!st) throw new ApiRequestError(404, "STATION_NOT_FOUND", "Rental station not found");
    const detail: RentalStationDetail = {
      ...st,
      vehicleTypesAvailable: [
        { id: "FIT", formFactor: "bicycle", propulsion: "human", count: Math.max(0, st.vehiclesAvailable - st.ebikesAvailable) },
        { id: "EFIT", formFactor: "bicycle", propulsion: "electric_assist", count: st.ebikesAvailable },
      ],
      network: networkInfo(),
    };
    return detail as T;
  }
  // ── v1.4 on-demand (taxi / ride-hailing) ──
  const publicProviders = async () => {
    const c = await liveCity();
    return (c.mobility?.onDemand ?? onDemandProviders)
      .filter((pv) => pv.enabled)
      .sort((a, b) => a.order - b.order)
      .map((pv) => {
        const pub = { ...pv, handoff: { ...pv.handoff, template: null, hasTemplate: pv.handoff.kind === "template" && !!pv.handoff.template } };
        delete pub.credentials;
        return pub;
      });
  };
  if (p === "/ondemand/providers") {
    const c = await liveCity();
    return { providers: await publicProviders(), policy: c.mobility?.onDemandPolicy ?? null } as T;
  }
  if (p === "/ondemand/estimate") {
    const from = { lat: num(q, "fromLat"), lon: num(q, "fromLon") };
    const to = { lat: num(q, "toLat"), lon: num(q, "toLon") };
    const at = q.time ? new Date(String(q.time)) : new Date();
    const dist = Math.round(haversineMeters(from, to) * 1.35);
    const dur = Math.max(300, Math.round(dist / 5.5));
    const airport = haversineMeters(to, { lat: 4.7016, lon: -74.1469 }) < 2500 || haversineMeters(from, { lat: 4.7016, lon: -74.1469 }) < 2500;
    const only = str(q, "providerId");
    const list = (await publicProviders()).filter((pv) => !only || pv.id === only);
    const out: OnDemandEstimateResponse = {
      route: { distanceMeters: dist, durationSeconds: dur, geometry: encodeGeometry([[from.lon, from.lat], [to.lon, to.lat]]) },
      estimates: list.map((pv) => ({
        providerId: pv.id,
        kind: pv.kind,
        name: pv.name,
        color: pv.color,
        price: pv.estimate.kind === "tariff" ? mockTaxiPrice(dist, at, airport ? ["airport"] : []) : null,
        waitSeconds: pv.kind === "taxi" ? 300 : null,
        handoffUrl: `/v1/cities/bogota/ondemand/handoff?providerId=${pv.id}&fromLat=${from.lat}&fromLon=${from.lon}&toLat=${to.lat}&toLon=${to.lon}`,
        source: pv.estimate.kind === "tariff" ? "tariff" : "none",
      })),
    };
    return out as T;
  }
  if (p === "/ondemand/handoff") {
    const c = await liveCity();
    const pv = (c.mobility?.onDemand ?? onDemandProviders).find((x) => x.id === str(q, "providerId"));
    if (!pv) throw new ApiRequestError(404, "PROVIDER_NOT_FOUND", "No such on-demand provider");
    const platform = str(q, "platform") || "web";
    const fallback = platform === "ios" && pv.handoff.apps?.ios ? pv.handoff.apps.ios : platform === "android" && pv.handoff.apps?.android ? pv.handoff.apps.android : (pv.handoff.web ?? pv.handoff.apps?.ios ?? pv.handoff.apps?.android ?? null);
    let url: string | null = null;
    if (pv.handoff.kind === "template" && pv.handoff.template) {
      const clientId = pv.credentials?.clientId && !/^[•*]/.test(pv.credentials.clientId) ? pv.credentials.clientId : "demo-client-id";
      const j = (lat: number, lon: number, name: string) => encodeURIComponent(JSON.stringify({ latitude: lat, longitude: lon, addressLine1: name }));
      url = pv.handoff.template
        .replace("{clientId}", encodeURIComponent(clientId))
        .replace("{pickupLat}", String(num(q, "fromLat")))
        .replace("{pickupLon}", String(num(q, "fromLon")))
        .replace("{dropoffLat}", String(num(q, "toLat")))
        .replace("{dropoffLon}", String(num(q, "toLon")))
        .replace("{pickupName}", encodeURIComponent(str(q, "fromName")))
        .replace("{dropoffName}", encodeURIComponent(str(q, "toName")))
        .replace("{pickupJson}", j(num(q, "fromLat"), num(q, "fromLon"), str(q, "fromName")))
        .replace("{dropoffJson}", j(num(q, "toLat"), num(q, "toLon"), str(q, "toName")));
    } else if (pv.handoff.kind === "url") url = fallback;
    const out: OnDemandHandoffResponse = { url, fallback, provider: { id: pv.id, name: pv.name, kind: pv.kind, color: pv.color } };
    return out as T;
  }
  const freshness = (): Freshness => ({ realtime: true, ageSeconds: 15 + Math.floor(Math.random() * 10), stale: false });

  m = p.match(/^\/stops\/([^/]+)\/board$/);
  if (m) {
    const s = stopById.get(decodeURIComponent(m[1]));
    if (!s) throw new ApiRequestError(404, "STOP_NOT_FOUND", "Stop not found");
    const per = num(q, "perRoute", 3);
    const deps = departures(s.id, 40);
    const rows = new Map<string, BoardResponse["rows"][number]>();
    for (const d of deps) {
      if (d.canceled) continue;
      const row = rows.get(d.route.id) ?? { route: d.route, headsign: d.headsign, next: [] };
      if (row.next.length < per) {
        const time = d.realtimeTime ?? d.scheduledTime;
        row.next.push({ time, minutes: Math.max(0, Math.round((new Date(time).getTime() - Date.now()) / 60000)), realtime: d.realtime, delaySeconds: d.delaySeconds, tripId: d.tripId, vehicleId: d.vehicleId });
      }
      rows.set(d.route.id, row);
    }
    const out: BoardResponse = {
      stop: s,
      generatedAt: iso(new Date()),
      freshness: freshness(),
      rows: [...rows.values()].sort((a, b) => (a.next[0]?.minutes ?? 99) - (b.next[0]?.minutes ?? 99)),
    };
    return out as T;
  }
  m = p.match(/^\/stops\/([^/]+)\/routes\/([^/]+)\/next$/);
  if (m) {
    const s = stopById.get(decodeURIComponent(m[1]));
    const r = routeById.get(decodeURIComponent(m[2]));
    if (!s) throw new ApiRequestError(404, "STOP_NOT_FOUND", "Stop not found");
    if (!r) throw new ApiRequestError(404, "ROUTE_NOT_FOUND", "Route not found");
    const limit = num(q, "limit", 3);
    // live rows: vehicles on this route, ordered by distance to the stop
    const live = currentVehicles()
      .filter((v) => v.routeId === r.id)
      .map((v) => ({ v, d: haversineMeters(v, s) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, Math.min(2, limit))
      .map(({ v, d }, i) => {
        const minutes = Math.max(1, Math.round(d / 350) + i); // ~21 km/h commercial speed
        return {
          minutes,
          time: iso(new Date(Date.now() + minutes * 60000)),
          source: "live" as const,
          vehicle: v,
          stopsAway: Math.max(1, Math.round(d / 600)),
          distanceMeters: Math.round(d),
          tripId: v.tripId,
        };
      });
    const sched = departures(s.id, 30)
      .filter((d) => d.route.id === r.id && !d.canceled)
      .map((d) => ({
        minutes: Math.max(0, Math.round((new Date(d.scheduledTime).getTime() - Date.now()) / 60000)),
        time: d.scheduledTime,
        source: "scheduled" as const,
        vehicle: null,
        stopsAway: null,
        distanceMeters: null,
        tripId: d.tripId,
      }))
      .filter((x) => !live.some((l) => Math.abs(l.minutes - x.minutes) < 2));
    const out: NextResponse = { stop: s, route: r, freshness: freshness(), next: [...live, ...sched].sort((a, b) => a.minutes - b.minutes).slice(0, limit) };
    return out as T;
  }
  if (p === "/pois") {
    const bbox = str(q, "bbox").split(",").map(Number);
    const types = str(q, "type") ? str(q, "type").split(",") : null;
    const features = pois.features.filter((f) => {
      const [lon, lat] = f.geometry.coordinates;
      const inBox = bbox.length === 4 ? lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3] : true;
      return inBox && (!types || types.includes(f.properties.type));
    });
    return { type: "FeatureCollection", features } as T;
  }

  m = p.match(/^\/stops\/([^/]+)\/departures$/);
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
  if (p === "/landing") {
    const { effectiveLanding } = await import("./admin");
    const c = await liveCity();
    const l = effectiveLanding();
    if (!l.enabled) throw new ApiRequestError(404, "LANDING_DISABLED", "landing page is disabled for this city");
    return {
      city: {
        id: c.id, name: c.name, country: c.country, locale: c.locale, branding: c.branding, attribution: c.attribution,
        links: c.links ?? null, services: c.services ?? null,
        mobility: c.mobility
          ? {
              bikeShare: c.mobility.bikeShare.map((n) => ({ id: n.id, name: n.name, color: n.color, url: n.url })),
              onDemand: (c.mobility.onDemand ?? []).filter((x) => x.enabled).map((x) => ({ id: x.id, name: x.name, color: x.color, kind: x.kind })),
            }
          : null,
      },
      landing: l,
      stats: { routes: 1024, stops: 8309, vehiclesLive: currentVehicles().length, bikeStations: rentalStations.length, alertsActive: alerts.length, generatedAt: iso(new Date()) },
      apps: l.apps,
    } as T;
  }
  if (p === "/health") {
    return {
      static: { feedVersion: "GTFS_20260904", fetchedAt: iso(new Date(Date.now() - 3600_000)), routes: 1024, stops: 8309 },
      realtime: { enabled: true, lastFetchAt: iso(new Date()), entityAgeP50Seconds: 18, vehicles: 220, pctTripResolved: 88.9, alerts: 3, stale: false, staleSeconds: null },
      router: { up: true, version: "2.10.0", graphBuiltAt: iso(new Date(Date.now() - 86400_000)) },
      rental: { networks: [{ id: "tembici", up: true, stations: rentalStations.length, vehiclesAvailable: rentalStations.reduce((a, s) => a + s.vehiclesAvailable, 0), ageSeconds: 12 }] },
      ondemand: { providers: onDemandProviders.filter((x) => x.enabled).length, tariffs: 1, routerCar: true },
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
