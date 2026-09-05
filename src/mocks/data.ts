/**
 * Realistic Bogotá fixtures for NEXT_PUBLIC_MOCK=1.
 * Coordinates follow the real Autopista Norte, Av. Caracas and NQS corridors
 * so shapes look right on the map. Route codes and times are illustrative.
 */
import { encodeGeometry, haversineMeters, type LngLat } from "@/lib/geo";
import { toIsoWithOffset } from "@/lib/format";
import type {
  LegOnDemand,
  OnDemandPrice,
  OnDemandProvider,
  TaxiTariff,
  Alert,
  BikeShareNetwork,
  City,
  CityLanding,
  Component,
  Itinerary,
  Leg,
  Mode,
  Place,
  PoiCollection,
  RentalStation,
  RouteRef,
  Stop,
  Vehicle,
  WalkStep,
} from "@/lib/api/types";

export const TZ = "America/Bogota";
const iso = (d: Date) => toIsoWithOffset(d, TZ);
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

export const city: City = {
  id: "bogota",
  name: "Bogotá",
  country: "CO",
  timezone: TZ,
  locale: "es-CO",
  center: { lat: 4.6534, lon: -74.0836 },
  bbox: [-74.45, 3.95, -73.85, 4.9],
  defaultZoom: 12,
  modes: ["WALK", "BUS", "CABLE_CAR", "BICYCLE"],
  branding: { primaryColor: "#D32F2F", logoUrl: null },
  features: {
    realtimeVehicles: true,
    tripUpdates: true,
    alerts: true,
    fares: false,
    bikeShare: true,
    onDemand: true,
  },
  agencies: [
    { id: "1", name: "TransMilenio Troncal", component: "trunk", color: "#D32F2F" },
    { id: "2", name: "Alimentadores", component: "feeder", color: "#2E7D4F" },
    { id: "3", name: "Dual", component: "dual", color: "#8E24AA" },
    { id: "4", name: "SITP Zonal Urbano", component: "zonal", color: "#1565C0" },
    { id: "7", name: "TransMiCable", component: "cable", color: "#6A1B9A" },
  ],
  attribution:
    "Datos: TRANSMILENIO S.A. (GTFS) · Mapa: © OpenMapTiles © OpenStreetMap contributors",
  // ── v1.1 ──
  components: [
    { id: "trunk", label: "Troncal", color: "#D32F2F", icon: "brt" },
    { id: "feeder", label: "Alimentador", color: "#2E7D4F", icon: "bus" },
    { id: "dual", label: "Dual", color: "#8E24AA", icon: "bus" },
    { id: "zonal", label: "Zonal", color: "#1565C0", icon: "bus" },
    { id: "cable", label: "TransMiCable", color: "#6A1B9A", icon: "cable" },
  ],
  fares: { currency: "COP", base: 3200, transfer: 0, transferWindowMinutes: 110, maxTransfers: 2, note: "Valores configurables; verificar con tarifa vigente", estimated: true },
  config: {
    vehiclePollSeconds: 15,
    departuresRefreshSeconds: 20,
    features: { liveVehicles: true, board: true, pois: true, followAlong: true, bike: true, next: true, favorites: true, alerts: true },
    minAppVersion: { ios: "1.0.0", android: "1.0.0" },
    maintenance: { active: false, message: null },
  },
  links: {
    pqrs: "https://www.transmilenio.gov.co/publicaciones/147212/pqrs/",
    recharge: "https://www.tullaveplus.gov.co/",
    support: "https://www.transmilenio.gov.co/",
    fares: "https://www.transmilenio.gov.co/publicaciones/151283/tarifas/",
    privacy: null,
  },
  services: [
    { id: "recharge", label: "Recargar tullave", icon: "card", url: "https://www.tullaveplus.gov.co/", kind: "external" },
    { id: "pqrs", label: "PQRS", icon: "chat", url: "https://www.transmilenio.gov.co/publicaciones/147212/pqrs/", kind: "external" },
  ],
  // ── v1.2: shared bikes (GBFS) ──
  mobility: {
    bikeShare: [
      {
        id: "tembici",
        name: "Tembici Bogotá",
        network: "tembici_bogota",
        gbfsUrl: "https://bogota.publicbikesystem.net/customer/gbfs/v3.0/gbfs.json",
        color: "#00A859",
        url: "https://tembici.com.co/",
        apps: { ios: "https://apps.apple.com/co/app/id1454932002", android: "https://play.google.com/store/apps/details?id=com.tembici.app" },
        pricingSummary: "Pase diario $11.000 · mensual $31.990",
        formFactors: ["bicycle"],
      },
    ],
    // ── v1.4: on-demand (taxi / ride-hailing) — every name below is fixture data, not code ──
    taxiTariffs: [
      {
        id: "taxi-2026",
        name: "Tarifa oficial de taxi 2026",
        currency: "COP",
        flagFall: 4500,
        unitPrice: 159,
        unitMeters: 100,
        unitSeconds: 30,
        minimumFare: 8000,
        surcharges: [
          { id: "night", label: "Nocturno / dominical / festivo", amount: 3800, when: { nightFrom: "19:00", nightTo: "06:00", sundays: true, holidays: true } },
          { id: "airport", label: "Aeropuerto", amount: 8000, when: { zones: ["airport"] } },
          { id: "door", label: "Puerta a puerta", amount: 1500, when: { optional: true } },
        ],
        zones: [{ id: "airport", name: "Aeropuerto El Dorado", polygon: [[-74.16, 4.69], [-74.13, 4.69], [-74.13, 4.715], [-74.16, 4.715]] }],
        source: { label: "Decreto Distrital 042 de 2026", url: "https://bogota.gov.co/mi-ciudad/movilidad/en-firme-el-decreto-que-fija-las-tarifas-de-taxi-en-bogota-en-2026" },
        validFrom: "2026-02-12",
        note: "Estimación según tarifa oficial; el taxímetro manda.",
      },
    ],
    onDemand: [
      { id: "taxi", name: "Taxi", kind: "taxi", color: "#F2C200", textColor: "#111111", logoUrl: null, estimate: { kind: "tariff", tariffId: "taxi-2026" }, handoff: { kind: "url", template: null, web: "https://www.taxislibres.com.co/", apps: { ios: null, android: null }, scheme: null }, enabled: true, order: 1 },
      { id: "uber", name: "Uber", kind: "ridehail", color: "#000000", textColor: "#FFFFFF", logoUrl: null, estimate: { kind: "none" }, handoff: { kind: "template", template: "https://m.uber.com/looking?client_id={clientId}&pickup={pickupJson}&drop[0]={dropoffJson}", web: "https://www.uber.com/co/", apps: { ios: "https://apps.apple.com/co/app/id368677368", android: "https://play.google.com/store/apps/details?id=com.ubercab" }, scheme: null, hasTemplate: true }, credentials: { clientId: "••••demo" }, enabled: true, order: 2 },
      { id: "cabify", name: "Cabify", kind: "ridehail", color: "#7145D6", textColor: "#FFFFFF", logoUrl: null, estimate: { kind: "none" }, handoff: { kind: "url", template: null, web: "https://cabify.com/co", apps: { ios: null, android: null }, scheme: null }, enabled: true, order: 3 },
      { id: "didi", name: "DiDi", kind: "ridehail", color: "#FF7F41", textColor: "#111111", logoUrl: null, estimate: { kind: "none" }, handoff: { kind: "url", template: null, web: "https://web.didiglobal.com/co/", apps: { ios: null, android: null }, scheme: null }, enabled: true, order: 4 },
      { id: "indrive", name: "inDrive", kind: "ridehail", color: "#A6E22E", textColor: "#111111", logoUrl: null, estimate: { kind: "none" }, handoff: { kind: "url", template: null, web: "https://indrive.com/", apps: { ios: null, android: null }, scheme: null }, enabled: true, order: 5 },
    ],
    onDemandPolicy: { maxDirectDistanceKm: 40, firstLastMile: true, maxFeederKm: 8, showWhenTransitFaster: true, durationFactor: 1.4, nightDurationFactor: 1.2 },
  },
};
export const tembici: BikeShareNetwork = city.mobility!.bikeShare[0];

// ── v1.3: public landing page (white-label; every string is content, not code) ──
const SHOTS = "https://raw.githubusercontent.com/jeronimotech/opentransit-web/main/docs/screenshots";
export const landing: CityLanding = {
  enabled: true,
  slug: null,
  locale: "es",
  theme: { primaryColor: null, accentColor: null, logoUrl: null, heroImageUrl: null, darkHero: true },
  hero: {
    title: "Muévete por Bogotá con datos en vivo",
    subtitle: "Planea tu viaje en TransMilenio, SITP, TransMiCable y bici pública. Gratis, sin cuenta y de código abierto.",
    ctaPrimary: { label: "Abrir la app web", url: null },
    ctaSecondary: { label: "Cómo funciona", url: "#features" },
  },
  apps: { ios: null, android: null, web: null },
  highlights: [
    { icon: "route", title: "Planea viajes multimodales", text: "Troncal, zonal, alimentador, cable y bici pública en un solo itinerario, con transbordos y tarifa estimada." },
    { icon: "live", title: "Buses en vivo", text: "Más de cinco mil buses en el mapa con su posición real, cada 15 segundos." },
    { icon: "board", title: "Ubica tu bus", text: "Elige tu estación y tu ruta: te decimos cuándo llega el próximo y si viene en vivo o por programación." },
    { icon: "bike", title: "Bicis públicas", text: "Estaciones con bicis y puestos disponibles, y viajes que combinan bici y bus." },
    { icon: "open", title: "Datos abiertos", text: "Los mismos feeds públicos de TRANSMILENIO S.A. Sin cuenta, sin rastreadores." },
  ],
  screenshots: [
    { url: `${SHOTS}/hub-mobile.png`, alt: "Mapa en vivo con la barra de búsqueda y las paradas cercanas", kind: "mobile" },
    { url: `${SHOTS}/next-mobile.png`, alt: "Ubica tu bus: próximos buses de una ruta en una estación", kind: "mobile" },
    { url: `${SHOTS}/itinerary-mobile.png`, alt: "Itinerario con tramos a pie y en bus", kind: "mobile" },
    { url: `${SHOTS}/stop-mobile.png`, alt: "Tablero de llegadas de una estación", kind: "mobile" },
    { url: `${SHOTS}/hub-desktop.png`, alt: "Versión web con el mapa completo", kind: "web" },
  ],
  stats: { show: true, items: ["routes", "stops", "vehiclesLive", "bikeStations", "alertsActive"] },
  partners: [
    { name: "TRANSMILENIO S.A.", logoUrl: null, url: "https://www.transmilenio.gov.co", role: "Datos GTFS y GTFS-Realtime" },
    { name: "Tembici Bogotá", logoUrl: null, url: "https://tembici.com.co/", role: "Feed GBFS de bicis públicas" },
  ],
  openData: {
    show: true,
    links: [
      { label: "GTFS estático", url: "https://gtfs.transmilenio.gov.co/GTFS.zip" },
      { label: "GTFS-Realtime: posiciones", url: "https://gtfs.transmilenio.gov.co/positions.pb" },
      { label: "GTFS-Realtime: alertas", url: "https://gtfs.transmilenio.gov.co/alerts.pb" },
      { label: "GBFS bicis públicas", url: "https://bogota.publicbikesystem.net/customer/gbfs/v3.0/gbfs.json" },
    ],
  },
  faq: [
    { q: "¿Necesito una cuenta?", a: "No. La app no pide registro ni guarda tu ubicación en ningún servidor. Tus favoritos viven en tu dispositivo." },
    { q: "¿La tarifa que muestra es oficial?", a: "Es una estimación calculada con la tarifa vigente y las reglas de transbordo. La tarifa oficial la fija TRANSMILENIO S.A." },
    { q: "¿Por qué algunos buses aparecen «por programación»?", a: "Cuando el feed en tiempo real no tiene datos de ese viaje, mostramos el horario programado y lo decimos claramente." },
    { q: "¿Puedo usar los datos en mi propio proyecto?", a: "Sí. Los feeds son públicos y el código de la app es libre bajo licencia MIT." },
  ],
  contact: { email: null, url: "https://www.transmilenio.gov.co/publicaciones/149179/canales-de-atencion/", social: { x: null, instagram: null, github: "https://github.com/jeronimotech" } },
  footer: { legalName: null, privacyUrl: null, termsUrl: null, attribution: null },
  seo: { title: null, description: null, ogImageUrl: null },
};


// ── Stations along the corridors ────────────────────────────────────────────
type S = [id: string, name: string, lat: number, lon: number, comp: Component, station?: boolean];

const NORTE: S[] = [
  ["7001", "Portal Norte", 4.7546, -74.0459, "trunk", true],
  ["7002", "Toberín", 4.7462, -74.0452, "trunk", true],
  ["7003", "Cardio Infantil", 4.7378, -74.0451, "trunk", true],
  ["7004", "Mazurén", 4.7318, -74.0452, "trunk", true],
  ["7005", "Calle 146", 4.7252, -74.0458, "trunk", true],
  ["7006", "Calle 142", 4.7201, -74.0472, "trunk", true],
  ["7007", "Alcalá", 4.7138, -74.0489, "trunk", true],
  ["7008", "Prado", 4.7079, -74.0509, "trunk", true],
  ["7009", "Calle 127", 4.7022, -74.0531, "trunk", true],
  ["7010", "Pepe Sierra", 4.6953, -74.0551, "trunk", true],
  ["7011", "Calle 106", 4.6901, -74.0562, "trunk", true],
  ["7012", "Calle 100", 4.6843, -74.0579, "trunk", true],
  ["7013", "Virrey", 4.6762, -74.0601, "trunk", true],
  ["7014", "Calle 85", 4.6702, -74.0606, "trunk", true],
  ["7015", "Héroes", 4.6661, -74.0621, "trunk", true],
];

const CARACAS: S[] = [
  ["7101", "Calle 76", 4.6621, -74.0641, "trunk", true],
  ["7102", "Calle 72", 4.6581, -74.0651, "trunk", true],
  ["7103", "Flores", 4.6541, -74.0661, "trunk", true],
  ["7104", "Calle 63", 4.6501, -74.0669, "trunk", true],
  ["7105", "Calle 57", 4.6441, -74.0671, "trunk", true],
  ["7106", "Marly", 4.6382, -74.0667, "trunk", true],
  ["7107", "Calle 45", 4.6331, -74.0666, "trunk", true],
  ["7108", "Av. 39", 4.6281, -74.0671, "trunk", true],
  ["7109", "Calle 34", 4.6231, -74.0681, "trunk", true],
  ["7110", "Calle 26", 4.6152, -74.0701, "trunk", true],
  ["7111", "Calle 22", 4.6111, -74.0711, "trunk", true],
  ["7112", "Calle 19", 4.6071, -74.0721, "trunk", true],
  ["7113", "Av. Jiménez", 4.6011, -74.0741, "trunk", true],
];

const NQS: S[] = [
  ["7201", "Simón Bolívar", 4.6572, -74.0729, "trunk", true],
  ["7202", "Movistar Arena", 4.6461, -74.0801, "trunk", true],
  ["7203", "El Campín", 4.6421, -74.0811, "trunk", true],
  ["7204", "CAD", 4.6321, -74.0841, "trunk", true],
  ["7205", "Paloquemao", 4.6221, -74.0901, "trunk", true],
  ["7206", "Ricaurte", 4.6121, -74.0941, "trunk", true],
  ["7207", "Comuneros", 4.6051, -74.0981, "trunk", true],
  ["7208", "Santa Isabel", 4.6001, -74.1031, "trunk", true],
  ["7209", "SENA", 4.5961, -74.1101, "trunk", true],
  ["7210", "NQS Calle 30 Sur", 4.5921, -74.1201, "trunk", true],
  ["7211", "General Santander", 4.5921, -74.1281, "trunk", true],
  ["7212", "Alquería", 4.5931, -74.1361, "trunk", true],
  ["7213", "Venecia", 4.5951, -74.1441, "trunk", true],
  ["7214", "Sevillana", 4.5971, -74.1501, "trunk", true],
  ["7215", "Portal Sur", 4.5978, -74.1616, "trunk", true],
];

const ZONAL: S[] = [
  ["12001", "Cl. 170 – Cra. 21", 4.7539, -74.0442, "zonal"],
  ["12002", "Cra. 19 – Cl. 161", 4.7461, -74.0412, "zonal"],
  ["12003", "Cra. 15 – Cl. 134", 4.7139, -74.0412, "zonal"],
  ["12004", "Cra. 15 – Cl. 116", 4.6981, -74.0471, "zonal"],
  ["12005", "Cra. 15 – Cl. 100", 4.6862, -74.0522, "zonal"],
  ["12006", "Cra. 15 – Cl. 85", 4.6712, -74.0562, "zonal"],
  ["12007", "Cl. 72 – Cra. 13", 4.6571, -74.0621, "zonal"],
  ["12008", "Cl. 53 – Cra. 13", 4.6421, -74.0651, "zonal"],
  ["12009", "Cl. 26 – Cra. 13", 4.6141, -74.0691, "zonal"],
  ["12010", "Cl. 13 – Cra. 30", 4.6132, -74.0931, "zonal"],
  ["12011", "Cl. 6 – Cra. 30", 4.6041, -74.0971, "zonal"],
  ["12012", "Av. 1 de Mayo – Cra. 30", 4.5991, -74.1061, "zonal"],
];

const CABLE: S[] = [
  ["9001", "Portal Tunal", 4.5742, -74.1329, "cable", true],
  ["9002", "Juan Pablo II", 4.5661, -74.1461, "cable", true],
  ["9003", "Manitas", 4.5601, -74.1521, "cable", true],
  ["9004", "Mirador del Paraíso", 4.5536, -74.1574, "cable", true],
];

const mkStop = ([id, name, lat, lon, component, station]: S): Stop => ({
  id: `bogota:${id}`,
  code: station ? null : `P${id.slice(-4)}`,
  name,
  lat,
  lon,
  locationType: station ? "station" : "stop",
  component,
  wheelchair: station ? "accessible" : "unknown",
  parentStationId: null,
  accessibility: station
    ? ["7001", "7215", "7012"].includes(id)
      ? { wheelchair: "accessible", source: "osm", verified: true, note: null }
      : { wheelchair: "accessible", source: "gtfs", verified: false, note: "Dato del feed no verificado" }
    : { wheelchair: "unknown", source: "none", verified: false, note: null },
});

export const stops: Stop[] = [...NORTE, ...CARACAS, ...NQS, ...ZONAL, ...CABLE].map(mkStop);
export const stopById = new Map(stops.map((s) => [s.id, s]));
const sById = (id: string) => stopById.get(`bogota:${id}`)!;

// ── Routes ───────────────────────────────────────────────────────────────────
const R = (
  id: string,
  shortName: string,
  longName: string,
  component: Component,
  color: string,
  mode: RouteRef["mode"] = "BUS",
): RouteRef => ({
  id: `bogota:${id}`,
  shortName,
  longName,
  color,
  textColor: color === "#F2B41B" ? "#14161A" : "#FFFFFF",
  mode,
  agencyId: { trunk: "1", feeder: "2", dual: "3", zonal: "4", cable: "7", rail: "1", other: "1" }[component],
  component,
  serviceWindow: windowFor(component),
});

function windowFor(component: Component): RouteRef["serviceWindow"] {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: TZ }).format(new Date()));
  const [start, end] = component === "cable" ? ["04:30", "22:00"] : component === "zonal" ? ["04:00", "22:30"] : ["04:00", "23:00"];
  const active = h >= Number(start.slice(0, 2)) && h < Number(end.slice(0, 2));
  return { start, end, active, nextStart: active ? null : start, source: "gtfs" };
}

export const routes: RouteRef[] = [
  R("B13", "B13", "Portal Norte – Portal Sur", "trunk", "#D32F2F"),
  R("B74", "B74", "Portal Norte – Ricaurte", "trunk", "#D32F2F"),
  R("G43", "G43", "Portal Sur – Calle 100", "trunk", "#D32F2F"),
  R("B1", "B1", "Portal Norte – Museo Nacional", "trunk", "#D32F2F"),
  R("H13", "H13", "Portal Usme – Portal Norte", "trunk", "#D32F2F"),
  R("D22", "D22", "Portal Américas – Calle 127", "trunk", "#D32F2F"),
  R("737", "737", "Toberín – Ricaurte", "zonal", "#1565C0"),
  R("T13", "T13", "Cl. 170 – Centro", "zonal", "#1565C0"),
  R("P500", "P500", "Suba – Calle 26", "zonal", "#1565C0"),
  R("9-1", "9-1", "Alimentador Toberín – Santa Cecilia", "feeder", "#2E7D4F"),
  R("M86", "M86", "Dual Portal Norte – Unicentro", "dual", "#8E24AA"),
  R("L1", "TransMiCable", "Portal Tunal – Mirador del Paraíso", "cable", "#6A1B9A", "CABLE_CAR"),
];
export const routeById = new Map(routes.map((r) => [r.id, r]));
const rt = (id: string) => routeById.get(`bogota:${id}`)!;

// ── Shapes ──────────────────────────────────────────────────────────────────
const coordsOf = (list: S[]): LngLat[] => list.map(([, , lat, lon]) => [lon, lat]);

// add slight curvature between stations so shapes don't look like straight lines
function densify(line: LngLat[], wobble = 0.0006): LngLat[] {
  const out: LngLat[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const [x1, y1] = line[i];
    const [x2, y2] = line[i + 1];
    out.push([x1, y1]);
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      const s = Math.sin(t * Math.PI) * wobble * (i % 2 === 0 ? 1 : -1);
      out.push([x1 + (x2 - x1) * t + s * 0.4, y1 + (y2 - y1) * t + s]);
    }
  }
  out.push(line[line.length - 1]);
  return out;
}

export const shapeNorteNQS = densify([...coordsOf(NORTE), ...coordsOf(NQS)]);
export const shapeNorteCaracas = densify([...coordsOf(NORTE), ...coordsOf(CARACAS)]);
export const shapeNQS = densify(coordsOf(NQS));
export const shapeZonal = densify(coordsOf(ZONAL), 0.0012);
export const shapeCable = coordsOf(CABLE);

export const shapes: { id: string; routeId: string; component: Component; color: string; coords: LngLat[] }[] = [
  { id: "sh-B13", routeId: "bogota:B13", component: "trunk", color: "#D32F2F", coords: shapeNorteNQS },
  { id: "sh-B74", routeId: "bogota:B74", component: "trunk", color: "#D32F2F", coords: shapeNorteNQS.slice(0, 80) },
  { id: "sh-G43", routeId: "bogota:G43", component: "trunk", color: "#D32F2F", coords: shapeNQS },
  { id: "sh-B1", routeId: "bogota:B1", component: "trunk", color: "#D32F2F", coords: shapeNorteCaracas },
  { id: "sh-H13", routeId: "bogota:H13", component: "trunk", color: "#D32F2F", coords: [...shapeNorteCaracas].reverse() },
  { id: "sh-737", routeId: "bogota:737", component: "zonal", color: "#1565C0", coords: shapeZonal },
  { id: "sh-T13", routeId: "bogota:T13", component: "zonal", color: "#1565C0", coords: shapeZonal.slice(0, 40) },
  { id: "sh-L1", routeId: "bogota:L1", component: "cable", color: "#6A1B9A", coords: shapeCable },
];

// ── Itineraries Portal Norte → Portal Sur ────────────────────────────────────
const place = (s: Stop, arr: Date | null, dep: Date | null): Place => ({
  name: s.name,
  lat: s.lat,
  lon: s.lon,
  stopId: s.id,
  stopCode: s.code,
  arrival: arr ? iso(arr) : null,
  departure: dep ? iso(dep) : null,
  component: s.component,
});

function sliceShape(line: LngLat[], from: Stop, to: Stop): LngLat[] {
  const idx = (s: Stop) => {
    let best = 0,
      bd = Infinity;
    line.forEach((c, i) => {
      const d = haversineMeters({ lat: c[1], lon: c[0] }, s);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };
  const a = idx(from),
    b = idx(to);
  return a <= b ? line.slice(a, b + 1) : line.slice(b, a + 1).reverse();
}

function walkLeg(from: Place, to: Place, start: Date, minutes: number, steps: WalkStep[]): Leg {
  const end = addMin(start, minutes);
  const coords: LngLat[] = [
    [from.lon, from.lat],
    [(from.lon + to.lon) / 2 + 0.0003, (from.lat + to.lat) / 2],
    [to.lon, to.lat],
  ];
  return {
    mode: "WALK",
    transit: false,
    startTime: iso(start),
    endTime: iso(end),
    durationSeconds: minutes * 60,
    distanceMeters: Math.max(Math.round(haversineMeters(from, to) * 1.25), steps.reduce((a, s) => a + s.distanceMeters, 0)),
    from: { ...from, departure: iso(start), arrival: null },
    to: { ...to, arrival: iso(end), departure: null },
    route: null,
    headsign: null,
    agency: null,
    tripId: null,
    realtime: false,
    realtimeState: null,
    delaySeconds: null,
    geometry: encodeGeometry(coords),
    intermediateStops: [],
    steps,
    alerts: [],
  };
}

function busLeg(
  route: RouteRef,
  line: LngLat[],
  corridor: S[],
  fromId: string,
  toId: string,
  start: Date,
  minutes: number,
  opts: { realtime?: boolean; delay?: number | null; headsign: string; alerts?: Alert[] },
): Leg {
  const from = sById(fromId),
    to = sById(toId);
  const end = addMin(start, minutes);
  const ids = corridor.map((s) => s[0]);
  const a = ids.indexOf(fromId),
    b = ids.indexOf(toId);
  const between = (a < b ? ids.slice(a + 1, b) : ids.slice(b + 1, a).reverse()).map(sById);
  const per = minutes / (between.length + 1);
  return {
    mode: route.mode,
    transit: true,
    startTime: iso(start),
    endTime: iso(end),
    durationSeconds: minutes * 60,
    distanceMeters: Math.round(haversineMeters(from, to) * 1.15),
    from: place(from, null, start),
    to: place(to, end, null),
    route,
    headsign: opts.headsign,
    agency: { id: route.agencyId, name: city.agencies.find((x) => x.id === route.agencyId)?.name ?? "" },
    tripId: `bogota:${route.shortName}-${start.getHours()}${start.getMinutes()}`,
    realtime: !!opts.realtime,
    realtimeState: opts.realtime ? "UPDATED" : "SCHEDULED",
    delaySeconds: opts.realtime ? (opts.delay ?? 0) : null,
    geometry: encodeGeometry(sliceShape(line, from, to)),
    intermediateStops: between.map((s, i) => place(s, addMin(start, per * (i + 1)), addMin(start, per * (i + 1)))),
    steps: [],
    alerts: opts.alerts ?? [],
  };
}

function itinerary(id: string, legs: Leg[]): Itinerary {
  const start = new Date(legs[0].startTime);
  const end = new Date(legs[legs.length - 1].endTime);
  const walk = legs.filter((l) => l.mode === "WALK");
  const transit = legs.filter((l) => l.transit);
  const duration = (end.getTime() - start.getTime()) / 1000;
  const walkTime = walk.reduce((a, l) => a + l.durationSeconds, 0);
  const ride = legs.filter((l) => l.transit || l.rental).reduce((a, l) => a + l.durationSeconds, 0);
  return {
    id,
    startTime: iso(start),
    endTime: iso(end),
    durationSeconds: duration,
    walkDistanceMeters: walk.reduce((a, l) => a + l.distanceMeters, 0),
    walkTimeSeconds: walkTime,
    waitingTimeSeconds: Math.max(0, duration - walkTime - ride),
    transfers: Math.max(0, transit.length - 1),
    fare: fareFor(transit.length),
    accessible: null,
    legs,
  };
}

function fareFor(transitLegs: number): Itinerary["fare"] {
  const f = city.fares!;
  if (!transitLegs) return { amount: 0, currency: f.currency, estimated: true, breakdown: [] };
  const transfers = Math.min(transitLegs - 1, f.maxTransfers);
  return {
    amount: f.base + transfers * f.transfer,
    currency: f.currency,
    estimated: true,
    breakdown: [{ label: "Pasaje", amount: f.base, kind: "transit" }, ...Array.from({ length: transfers }, () => ({ label: "Transbordo", amount: f.transfer, kind: "transit" }))],
  };
}

export const alerts: Alert[] = [
  {
    id: "al-1",
    cause: "CONSTRUCTION",
    effect: "DETOUR",
    severity: "WARNING",
    header: "Desvío en la Av. Caracas entre Calle 26 y Calle 19",
    description:
      "Por obras del Metro de Bogotá, las rutas B1 y H13 no paran en Calle 22. Usa Calle 26 o Calle 19.",
    url: "https://www.transmilenio.gov.co/",
    start: iso(addMin(new Date(), -60 * 24 * 3)),
    end: iso(addMin(new Date(), 60 * 24 * 40)),
    routeIds: ["bogota:B1", "bogota:H13"],
    stopIds: ["bogota:7111"],
    routes: [rt("B1"), rt("H13")],
  },
  {
    id: "al-2",
    cause: "MAINTENANCE",
    effect: "REDUCED_SERVICE",
    severity: "INFO",
    header: "TransMiCable con frecuencia reducida el domingo",
    description: "Mantenimiento programado entre 6:00 y 9:00. Tiempo de espera estimado: 8 minutos.",
    url: null,
    start: iso(addMin(new Date(), -60 * 2)),
    end: iso(addMin(new Date(), 60 * 24 * 2)),
    routeIds: ["bogota:L1"],
    stopIds: [],
    routes: [rt("L1")],
  },
  {
    id: "al-3",
    cause: "DEMONSTRATION",
    effect: "SIGNIFICANT_DELAYS",
    severity: "SEVERE",
    header: "Manifestación en Ricaurte: demoras en la NQS",
    description: "Las rutas por la NQS presentan demoras de hasta 20 minutos. Considera la Av. Caracas.",
    url: null,
    start: iso(addMin(new Date(), -30)),
    end: null,
    routeIds: ["bogota:B13", "bogota:G43", "bogota:B74"],
    stopIds: ["bogota:7206", "bogota:7205"],
    routes: [rt("B13"), rt("G43"), rt("B74")],
  },
];

export function buildItineraries(from: Place, to: Place, time: Date, arriveBy: boolean): Itinerary[] {
  const t0 = arriveBy ? addMin(time, -85) : addMin(time, 2);
  const portalNorte = sById("7001"),
    portalSur = sById("7215"),
    ricaurte = sById("7206");

  // 1 · Direct B13
  const w1 = walkLeg(from, place(portalNorte, null, null), t0, 3, [
    { instruction: "", distanceMeters: 60, lat: from.lat, lon: from.lon, relativeDirection: "DEPART", streetName: "Calle 174" },
    { instruction: "", distanceMeters: 190, lat: from.lat - 0.0004, lon: from.lon + 0.0002, relativeDirection: "RIGHT", streetName: "Autopista Norte" },
  ]);
  const b13 = busLeg(rt("B13"), shapeNorteNQS, [...NORTE, ...NQS], "7001", "7215", addMin(t0, 5), 58, {
    realtime: true,
    delay: 60,
    headsign: "Portal Sur",
    alerts: [alerts[2]],
  });
  const w1b = walkLeg(place(portalSur, null, null), to, addMin(t0, 63), 2, [
    { instruction: "", distanceMeters: 120, lat: portalSur.lat, lon: portalSur.lon, relativeDirection: "DEPART", streetName: "Autopista Sur" },
  ]);

  // 2 · B74 → G43 via Ricaurte
  const w2 = walkLeg(from, place(portalNorte, null, null), addMin(t0, 1), 3, w1.steps);
  const b74 = busLeg(rt("B74"), shapeNorteNQS, [...NORTE, ...NQS], "7001", "7206", addMin(t0, 7), 34, {
    realtime: true,
    delay: 180,
    headsign: "Ricaurte",
  });
  const tw = walkLeg(place(ricaurte, null, null), place(ricaurte, null, null), addMin(t0, 41), 2, [
    { instruction: "", distanceMeters: 80, lat: ricaurte.lat, lon: ricaurte.lon, relativeDirection: "ENTER_STATION", streetName: "Ricaurte" },
  ]);
  const g43 = busLeg(rt("G43"), shapeNQS, NQS, "7206", "7215", addMin(t0, 47), 24, {
    realtime: false,
    headsign: "Portal Sur",
  });
  const w2b = walkLeg(place(portalSur, null, null), to, addMin(t0, 71), 2, w1b.steps);

  // 3 · Zonal 737 → G43
  const z0 = sById("12001"),
    z1 = sById("12010");
  const w3 = walkLeg(from, place(z0, null, null), addMin(t0, 0), 4, [
    { instruction: "", distanceMeters: 300, lat: from.lat, lon: from.lon, relativeDirection: "DEPART", streetName: "Calle 170" },
  ]);
  const z737 = busLeg(rt("737"), shapeZonal, ZONAL, "12001", "12010", addMin(t0, 9), 52, {
    realtime: true,
    delay: -60,
    headsign: "Ricaurte",
  });
  const tw3 = walkLeg(place(z1, null, null), place(ricaurte, null, null), addMin(t0, 61), 5, [
    { instruction: "", distanceMeters: 210, lat: z1.lat, lon: z1.lon, relativeDirection: "DEPART", streetName: "Calle 13" },
    { instruction: "", distanceMeters: 160, lat: ricaurte.lat, lon: ricaurte.lon, relativeDirection: "LEFT", streetName: "Carrera 30" },
  ]);
  const g43b = busLeg(rt("G43"), shapeNQS, NQS, "7206", "7215", addMin(t0, 70), 24, {
    realtime: false,
    headsign: "Portal Sur",
  });
  const w3b = walkLeg(place(portalSur, null, null), to, addMin(t0, 94), 2, w1b.steps);

  return [
    itinerary("it-0", [w1, b13, w1b]),
    itinerary("it-1", [w2, b74, tw, g43, w2b]),
    itinerary("it-2", [w3, z737, tw3, g43b, w3b]),
  ];
}

// ── Shared bikes: 60 Tembici-like stations around Chapinero / Usaquén ────────
/**
 * Deterministic grid with a little jitter between Calle 72 and Calle 127, Cra 7 to Cra 19,
 * roughly where the real system is densest. Availability is pseudo-random but stable.
 */
const CALLES = [72, 76, 80, 85, 90, 93, 97, 100, 106, 110, 116, 120, 122, 127, 134];
const CARRERAS = [7, 11, 15, 19];
function stationName(i: number, calle: number, cra: number) {
  return `${String(i + 1).padStart(3, "0")} - CL ${calle} con KR ${cra}`;
}
export const rentalStations: RentalStation[] = CALLES.flatMap((calle, ci) =>
  CARRERAS.map((cra, ki) => {
    const i = ci * CARRERAS.length + ki;
    const h = (i * 2654435761) >>> 0; // hash → stable pseudo-random
    const lat = 4.6581 + (calle - 72) * 0.00118 + ((h % 7) - 3) * 0.00025;
    const lon = -74.0405 - (cra - 7) * 0.00123 + (((h >> 3) % 7) - 3) * 0.00025;
    const capacity = 15 + (h % 3) * 4;
    const bikes = i % 11 === 0 ? 0 : (h >> 5) % Math.max(2, capacity - 2);
    const docks = i % 13 === 5 ? 0 : Math.max(0, capacity - bikes - ((h >> 9) % 3));
    return {
      id: `tembici:${i + 1}`,
      networkId: "tembici",
      name: stationName(i, calle, cra),
      lat: +lat.toFixed(6),
      lon: +lon.toFixed(6),
      capacity,
      vehiclesAvailable: bikes,
      ebikesAvailable: bikes ? (h >> 11) % Math.min(3, bikes + 1) : 0,
      docksAvailable: docks,
      isInstalled: true,
      isRenting: i % 29 !== 7,
      isReturning: true,
      lastReported: iso(new Date(Date.now() - ((h >> 13) % 50) * 1000)),
    };
  }),
);
export const rentalStationById = new Map(rentalStations.map((s) => [s.id, s]));

/** Nearest station to a point (for pickup/drop-off in mock itineraries). */
export function nearestRentalStation(p: { lat: number; lon: number }, exclude?: string): RentalStation {
  let best = rentalStations[0],
    bd = Infinity;
  for (const s of rentalStations) {
    if (s.id === exclude) continue;
    const d = haversineMeters(p, s);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

const rentalRef = (s: RentalStation) => ({ stationId: s.id, name: s.name, lat: s.lat, lon: s.lon, vehiclesAvailable: s.vehiclesAvailable, docksAvailable: s.docksAvailable, lastReported: s.lastReported });
const rentalPlace = (s: RentalStation, arr: Date | null, dep: Date | null): Place => ({
  name: s.name,
  lat: s.lat,
  lon: s.lon,
  stopId: null,
  stopCode: null,
  arrival: arr ? iso(arr) : null,
  departure: dep ? iso(dep) : null,
  component: null,
  rentalStationId: s.id,
});

function rentalLeg(pickup: RentalStation, dropoff: RentalStation, start: Date, minutes: number): Leg {
  const end = addMin(start, minutes);
  const coords = densify(
    [
      [pickup.lon, pickup.lat],
      [(pickup.lon + dropoff.lon) / 2 - 0.0012, (pickup.lat + dropoff.lat) / 2],
      [dropoff.lon, dropoff.lat],
    ],
    0.0004,
  );
  return {
    mode: "BICYCLE",
    transit: false,
    startTime: iso(start),
    endTime: iso(end),
    durationSeconds: minutes * 60,
    distanceMeters: Math.round(haversineMeters(pickup, dropoff) * 1.3),
    from: rentalPlace(pickup, null, start),
    to: rentalPlace(dropoff, end, null),
    route: null,
    headsign: null,
    agency: null,
    tripId: null,
    realtime: false,
    realtimeState: null,
    delaySeconds: null,
    geometry: encodeGeometry(coords),
    intermediateStops: [],
    steps: [
      { instruction: "", distanceMeters: 180, lat: pickup.lat, lon: pickup.lon, relativeDirection: "DEPART", streetName: "Ciclorruta Cra 11" },
      { instruction: "", distanceMeters: Math.max(200, Math.round(haversineMeters(pickup, dropoff)) - 180), lat: dropoff.lat, lon: dropoff.lon, relativeDirection: "CONTINUE", streetName: "Ciclorruta Cra 11" },
    ],
    alerts: [],
    rental: {
      networkId: tembici.id,
      networkName: tembici.name,
      color: tembici.color,
      vehicleType: pickup.ebikesAvailable > 0 ? "electric_assist" : "bicycle",
      pickup: rentalRef(pickup),
      dropoff: rentalRef(dropoff),
      freeFloating: false,
      priceEstimate: { amount: 11000, currency: "COP", label: "Pase diario", estimated: true },
    },
  };
}

/** Itineraries that use a shared bike: direct, and bike → Portal Norte → B13. */
export function buildRentalItineraries(from: Place, to: Place, time: Date, arriveBy: boolean, withTransit: boolean): Itinerary[] {
  const t0 = arriveBy ? addMin(time, -60) : addMin(time, 1);
  const pick = nearestRentalStation(from);
  const walkTo = walkLeg(from, rentalPlace(pick, null, null), t0, 3, [
    { instruction: "", distanceMeters: Math.round(haversineMeters(from, pick)), lat: from.lat, lon: from.lon, relativeDirection: "DEPART", streetName: "Calle 85" },
  ]);
  const out: Itinerary[] = [];

  // 1 · direct: bike from the nearest station to the one nearest the destination
  const drop = nearestRentalStation(to, pick.id);
  const rideMin = Math.max(6, Math.round((haversineMeters(pick, drop) * 1.3) / 250)); // ~15 km/h
  const ride = rentalLeg(pick, drop, addMin(t0, 3), rideMin);
  const walkEnd = walkLeg(rentalPlace(drop, null, null), to, addMin(t0, 3 + rideMin), 2, [
    { instruction: "", distanceMeters: Math.round(haversineMeters(drop, to)), lat: drop.lat, lon: drop.lon, relativeDirection: "DEPART", streetName: "Calle 100" },
  ]);
  const direct = itinerary("it-bike-0", [walkTo, ride, walkEnd]);
  out.push({
    ...direct,
    fare: { amount: 11000, currency: "COP", estimated: true, breakdown: [{ label: `${tembici.name} · pase diario`, amount: 11000, kind: "rental" }] },
    rentalLegs: 1,
    modesUsed: ["WALK", "BICYCLE_RENTAL"],
  });

  // 2 · bike to the trunk station nearest the origin, then B13
  if (withTransit) {
    const hub = sById("7012"); // Calle 100
    const dropHub = nearestRentalStation(hub, pick.id);
    const toHubMin = Math.max(5, Math.round((haversineMeters(pick, dropHub) * 1.3) / 250));
    const ride2 = rentalLeg(pick, dropHub, addMin(t0, 3), toHubMin);
    const w2 = walkLeg(rentalPlace(dropHub, null, null), place(hub, null, null), addMin(t0, 3 + toHubMin), 3, [
      { instruction: "", distanceMeters: Math.round(haversineMeters(dropHub, hub)), lat: dropHub.lat, lon: dropHub.lon, relativeDirection: "DEPART", streetName: "Calle 100" },
    ]);
    const bus = busLeg(rt("B13"), shapeNorteNQS, [...NORTE, ...NQS], "7012", "7215", addMin(t0, 9 + toHubMin), 44, { realtime: true, delay: 60, headsign: "Portal Sur" });
    const w3 = walkLeg(place(sById("7215"), null, null), to, addMin(t0, 53 + toHubMin), 2, [
      { instruction: "", distanceMeters: 120, lat: to.lat, lon: to.lon, relativeDirection: "DEPART", streetName: "Autopista Sur" },
    ]);
    const it = itinerary("it-bike-1", [walkTo, ride2, w2, bus, w3]);
    const fare = it.fare!;
    out.push({
      ...it,
      fare: { ...fare, amount: fare.amount + 11000, breakdown: [...(fare.breakdown ?? []).map((b) => ({ ...b, kind: "transit" })), { label: `${tembici.name} · pase diario`, amount: 11000, kind: "rental" }] },
      rentalLegs: 1,
      modesUsed: ["WALK", "BICYCLE_RENTAL", "BUS"],
    });
  }
  return out;
}


// ── v1.4: on-demand (taxi / ride-hailing) itineraries ────────────────────────
export const taxiTariff: TaxiTariff = city.mobility!.taxiTariffs![0];
export const onDemandProviders: OnDemandProvider[] = city.mobility!.onDemand!;

/** Same rule as lib/ondemand.estimateTaxi, kept inline so the mock has no UI dependency. */
export function mockTaxiPrice(distanceMeters: number, at: Date, zones: string[] = []): OnDemandPrice {
  const t = taxiTariff;
  const units = Math.ceil(distanceMeters / t.unitMeters);
  let amount = Math.max(t.minimumFare, t.flagFall + units * t.unitPrice);
  const breakdown = [
    { label: "Banderazo", amount: t.flagFall },
    { label: `${units} unidades`, amount: units * t.unitPrice },
  ];
  const applied: string[] = [];
  const hh = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hour12: false }).format(at)) % 24;
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(at);
  for (const sc of t.surcharges) {
    const w = sc.when;
    const on = w.optional ? false : w.zones?.length ? w.zones.some((z) => zones.includes(z)) : (w.sundays && wd === "Sun") || (w.nightFrom && (hh >= 19 || hh < 6));
    if (!on) continue;
    applied.push(sc.id);
    amount += sc.amount;
    breakdown.push({ label: sc.label, amount: sc.amount });
  }
  const r = (n: number) => Math.round(n / 100) * 100;
  return { amount, min: r(amount * 0.9), max: r(amount * 1.1), currency: t.currency, estimated: true, breakdown, surchargesApplied: applied, note: t.note };
}

function handoffUrl(providerId: string, from: Place, to: Place): string {
  const q = new URLSearchParams({ providerId, fromLat: String(from.lat), fromLon: String(from.lon), toLat: String(to.lat), toLon: String(to.lon), fromName: from.name, toName: to.name, redirect: "1" });
  return `/v1/cities/bogota/ondemand/handoff?${q.toString()}`;
}

export function onDemandBlock(from: Place, to: Place, distanceMeters: number, at: Date): LegOnDemand {
  const zones = haversineMeters(to, { lat: 4.7016, lon: -74.1469 }) < 2500 || haversineMeters(from, { lat: 4.7016, lon: -74.1469 }) < 2500 ? ["airport"] : [];
  const providers = onDemandProviders
    .filter((p) => p.enabled)
    .sort((a, b) => a.order - b.order)
    .map((p) => ({
      providerId: p.id,
      name: p.name,
      color: p.color,
      textColor: p.textColor ?? null,
      kind: p.kind,
      price: p.estimate.kind === "tariff" ? mockTaxiPrice(distanceMeters, at, zones) : null,
      waitSeconds: p.kind === "taxi" ? 300 : null,
      handoffUrl: handoffUrl(p.id, from, to),
      source: (p.estimate.kind === "tariff" ? "tariff" : "none") as "tariff" | "none",
    }));
  return { kind: "taxi", providers, recommendedProviderId: providers.find((p) => p.price)?.providerId ?? providers[0]?.providerId ?? null };
}

function carLeg(from: Place, to: Place, start: Date, minutes: number): Leg {
  const end = addMin(start, minutes);
  const dist = Math.round(haversineMeters(from, to) * 1.35);
  const coords: LngLat[] = [
    [from.lon, from.lat],
    [(from.lon + to.lon) / 2 - 0.004, (from.lat + to.lat) / 2 + 0.003],
    [to.lon, to.lat],
  ];
  return {
    mode: "CAR",
    transit: false,
    startTime: iso(start),
    endTime: iso(end),
    durationSeconds: minutes * 60,
    distanceMeters: dist,
    from: { ...from, departure: iso(start), arrival: null },
    to: { ...to, arrival: iso(end), departure: null },
    route: null,
    headsign: null,
    agency: null,
    tripId: null,
    realtime: false,
    realtimeState: null,
    delaySeconds: null,
    geometry: encodeGeometry(coords),
    intermediateStops: [],
    steps: [],
    alerts: [],
    onDemand: onDemandBlock(from, to, dist, start),
  };
}

/** A direct taxi/app trip and a "Taxi → Bus" combo (taxi to the nearest trunk station, then B13). */
export function buildOnDemandItineraries(from: Place, to: Place, time: Date, arriveBy: boolean, withTransit: boolean): Itinerary[] {
  const t0 = arriveBy ? addMin(time, -45) : addMin(time, 4); // ~4 min pickup
  const out: Itinerary[] = [];
  const directMin = Math.max(8, Math.round((haversineMeters(from, to) * 1.35) / 330)); // ~20 km/h city traffic
  const direct = itinerary("it-taxi-0", [carLeg(from, to, t0, directMin)]);
  const lead = direct.legs[0].onDemand!.providers.find((p) => p.price)!;
  out.push({
    ...direct,
    fare: { amount: lead.price!.amount as number, currency: lead.price!.currency, estimated: true, breakdown: [{ label: `${lead.name} · ${direct.legs[0].distanceMeters > 0 ? "estimado" : ""}`.trim(), amount: lead.price!.amount as number, kind: "ondemand" }] },
    modesUsed: ["CAR_ONDEMAND"],
    source: "ondemand",
  });
  if (withTransit) {
    const hub = sById("7012"); // Calle 100
    const hubPlace = place(hub, null, null);
    const feederMin = Math.max(5, Math.round((haversineMeters(from, hub) * 1.35) / 330));
    const car = carLeg(from, hubPlace, t0, feederMin);
    const bus = busLeg(rt("B13"), shapeNorteNQS, [...NORTE, ...NQS], "7012", "7215", addMin(t0, feederMin + 3), 44, { realtime: true, delay: 60, headsign: "Portal Sur" });
    const w = walkLeg(place(sById("7215"), null, null), to, addMin(t0, feederMin + 47), 2, [
      { instruction: "", distanceMeters: 120, lat: to.lat, lon: to.lon, relativeDirection: "DEPART", streetName: "Autopista Sur" },
    ]);
    const it = itinerary("it-taxi-1", [car, bus, w]);
    const carLead = car.onDemand!.providers.find((p) => p.price)!;
    const fare = it.fare!;
    out.push({
      ...it,
      fare: { ...fare, amount: fare.amount + (carLead.price!.amount as number), breakdown: [{ label: carLead.name, amount: carLead.price!.amount as number, kind: "ondemand" }, ...(fare.breakdown ?? []).map((b) => ({ ...b, kind: "transit" }))] },
      modesUsed: ["CAR_ONDEMAND", "BUS", "WALK"],
      source: "ondemand",
    });
  }
  return out;
}

/** Does the requested `modes` list ask for shared bikes / transit? */
export function modeFlags(modes: string | null | undefined): { rental: boolean; transit: boolean } {
  const m = (modes ?? "").split(",").filter(Boolean) as Mode[];
  const rental = m.includes("BIKE_RENTAL") || m.includes("SCOOTER_RENTAL");
  const transit = m.length === 0 || m.some((x) => !["WALK", "BICYCLE", "BIKE_RENTAL", "SCOOTER_RENTAL", "SCOOTER"].includes(x));
  return { rental, transit };
}

// ── Vehicles ─────────────────────────────────────────────────────────────────
type Sim = { v: Vehicle; shape: LngLat[]; idx: number; dir: 1 | -1 };
const sims: Sim[] = [];

function seed(n: number) {
  const pool = shapes.filter((s) => s.coords.length > 5);
  for (let i = 0; i < n; i++) {
    const sh = pool[i % pool.length];
    const route = routeById.get(sh.routeId)!;
    const idx = Math.floor(((i * 7919) % 1000) / 1000 * sh.coords.length);
    const [lon, lat] = sh.coords[idx];
    const resolved = i % 9 !== 0;
    sims.push({
      shape: sh.coords,
      idx,
      dir: i % 2 ? 1 : -1,
      v: {
        id: `V${1000 + i}`,
        label: `${route.component === "zonal" ? "Z" : route.component === "cable" ? "C" : "B"}${(3000 + i * 13) % 9000}`,
        routeId: route.id,
        routeShortName: route.shortName,
        tripId: resolved ? `bogota:${route.shortName}-${i}` : null,
        tripResolved: resolved,
        component: route.component,
        lat,
        lon,
        bearing: null,
        timestamp: iso(new Date()),
        stopId: null,
        stopSequence: null,
        occupancy: (["MANY_SEATS_AVAILABLE", "FEW_SEATS_AVAILABLE", "STANDING_ROOM_ONLY", null] as const)[i % 4],
      },
    });
  }
}
seed(220);

export function currentVehicles(): Vehicle[] {
  return sims.map((s) => s.v);
}

/** Advance every vehicle one step along its shape; returns the ones that moved. */
export function tickVehicles(): Vehicle[] {
  const moved: Vehicle[] = [];
  const now = iso(new Date());
  for (const s of sims) {
    if (Math.random() < 0.3) continue; // some buses stand still (like the real feed)
    let next = s.idx + s.dir;
    if (next < 0 || next >= s.shape.length) {
      s.dir = (s.dir * -1) as 1 | -1;
      next = s.idx + s.dir;
    }
    const [lon, lat] = s.shape[next];
    const [plon, plat] = s.shape[s.idx];
    s.idx = next;
    const br = (Math.atan2(lon - plon, lat - plat) * 180) / Math.PI;
    s.v = { ...s.v, lat, lon, bearing: (br + 360) % 360, timestamp: now };
    moved.push(s.v);
  }
  return moved;
}

export function vehicleTrail(id: string): [number, number, number][] {
  const s = sims.find((x) => x.v.id === id);
  if (!s) return [];
  const now = Math.floor(Date.now() / 1000);
  const out: [number, number, number][] = [];
  for (let k = 12; k >= 0; k--) {
    const i = Math.max(0, Math.min(s.shape.length - 1, s.idx - k * s.dir));
    out.push([s.shape[i][0], s.shape[i][1], now - k * 60]);
  }
  return out;
}

export function corridorFor(stopId: string): { routes: RouteRef[]; headsigns: string[] } {
  const id = stopId.replace("bogota:", "");
  if (NORTE.some((s) => s[0] === id)) return { routes: [rt("B13"), rt("B74"), rt("B1"), rt("H13"), rt("M86")], headsigns: ["Portal Sur", "Ricaurte", "Museo Nacional", "Portal Usme", "Unicentro"] };
  if (CARACAS.some((s) => s[0] === id)) return { routes: [rt("B1"), rt("H13")], headsigns: ["Museo Nacional", "Portal Norte"] };
  if (NQS.some((s) => s[0] === id)) return { routes: [rt("B13"), rt("G43"), rt("B74")], headsigns: ["Portal Sur", "Calle 100", "Portal Norte"] };
  if (ZONAL.some((s) => s[0] === id)) return { routes: [rt("737"), rt("T13"), rt("P500")], headsigns: ["Ricaurte", "Centro", "Calle 26"] };
  if (CABLE.some((s) => s[0] === id)) return { routes: [rt("L1")], headsigns: ["Mirador del Paraíso"] };
  return { routes: [rt("737")], headsigns: ["Ricaurte"] };
}

export const corridors = { NORTE, CARACAS, NQS, ZONAL, CABLE };


// ── Station services (POIs) ─────────────────────────────────────────────────
const poiAt = (id: string, type: PoiCollection["features"][number]["properties"]["type"], name: string, stop: string, dLon: number, dLat: number, wc: "yes" | "no" | "limited" | null = null) => {
  const s = sById(stop);
  return {
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [s.lon + dLon, s.lat + dLat] as [number, number] },
    properties: { id, type, name, source: "osm" as const, osmId: `node/${id}`, wheelchair: wc },
  };
};
export const pois: PoiCollection = {
  type: "FeatureCollection",
  features: [
    poiAt("p1", "bike_parking", "Cicloparqueadero Portal Norte", "7001", 0.0006, 0.0003, "yes"),
    poiAt("p2", "toilets", "Baños Portal Norte", "7001", -0.0004, 0.0002, "yes"),
    poiAt("p3", "atm", "Cajero Portal Norte", "7001", 0.0002, -0.0004, null),
    poiAt("p4", "library", "BiblioEstación Portal Norte", "7001", -0.0007, -0.0002, "limited"),
    poiAt("p5", "bike_parking", "Cicloparqueadero Calle 100", "7012", 0.0005, 0.0002, "yes"),
    poiAt("p6", "health", "Punto de salud Calle 100", "7012", -0.0004, -0.0003, null),
    poiAt("p7", "bike_parking", "Cicloparqueadero Portal Sur", "7215", 0.0006, 0.0002, "yes"),
    poiAt("p8", "toilets", "Baños Portal Sur", "7215", -0.0004, 0.0003, "no"),
    poiAt("p9", "atm", "Cajero Ricaurte", "7206", 0.0003, 0.0003, null),
    poiAt("p10", "bike_parking", "Cicloparqueadero Portal Tunal", "9001", 0.0005, 0.0002, "yes"),
    poiAt("p11", "toilets", "Baños Calle 26", "7110", 0.0004, -0.0002, "yes"),
    poiAt("p12", "library", "BiblioEstación Calle 26", "7110", -0.0005, 0.0003, "yes"),
  ],
};
