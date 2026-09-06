/**
 * Mock analytics for NEXT_PUBLIC_MOCK=1: accepts event batches (202) and serves realistic
 * Bogotá aggregates for the admin "Analítica" tab. Everything is deterministic per range so
 * screenshots are stable. Cells follow the trunk corridors (Autopista Norte, Caracas, Calle 26,
 * NQS, Américas); the top O-D pairs run Portal Norte ↔ centro and Suba ↔ Chapinero.
 */
import { ApiRequestError } from "@/lib/api/client";
import type {
  AnalyticsAccepted,
  AnalyticsBatch,
  AnalyticsFunnelResponse,
  AnalyticsHoursResponse,
  AnalyticsModesResponse,
  AnalyticsOdResponse,
  AnalyticsPlacesResponse,
  AnalyticsProvidersResponse,
  AnalyticsRoutesResponse,
  AnalyticsSearchesResponse,
  AnalyticsStopsResponse,
  AnalyticsSummary,
} from "@/lib/api/types";

const K = 5;
export const receivedEvents: AnalyticsBatch[] = [];

/** Tiny seeded PRNG so a given range always draws the same numbers. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
const daysBetween = (from: string, to: string) => Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1);
const seedOf = (from: string, to: string) => (Date.parse(from) / 86_400_000) * 31 + daysBetween(from, to);

/* ── geohash-7 cells (we fake the id but keep real ~150 m boxes) ── */
const CELL = 0.0014; // ≈150 m in degrees
function cellId(lat: number, lon: number) {
  const a = Math.floor((lat + 90) / CELL), b = Math.floor((lon + 180) / CELL);
  return `c${a.toString(36)}${b.toString(36)}`;
}
function cellPolygon(lat: number, lon: number): number[][][] {
  const la = Math.floor(lat / CELL) * CELL, lo = Math.floor(lon / CELL) * CELL;
  return [[[lo, la], [lo + CELL, la], [lo + CELL, la + CELL], [lo, la + CELL], [lo, la]]];
}

/** Corridors: [lat, lon] samples along Bogotá's trunk lines and dense neighbourhoods. */
const CORRIDORS: { name: string; pts: [number, number][]; weight: number }[] = [
  { name: "Autopista Norte", pts: [[4.7546, -74.0459], [4.7395, -74.0445], [4.7215, -74.0466], [4.7050, -74.0500], [4.6841, -74.0517], [4.6710, -74.0560], [4.6600, -74.0600]], weight: 1.0 },
  { name: "Caracas", pts: [[4.6500, -74.0630], [4.6400, -74.0700], [4.6300, -74.0750], [4.6150, -74.0790], [4.6000, -74.0830], [4.5870, -74.0880]], weight: 0.9 },
  { name: "Calle 26", pts: [[4.6120, -74.0800], [4.6180, -74.0900], [4.6250, -74.1000], [4.6350, -74.1100], [4.6500, -74.1200]], weight: 0.6 },
  { name: "NQS", pts: [[4.6800, -74.0700], [4.6550, -74.0800], [4.6300, -74.0900], [4.6100, -74.0950], [4.5900, -74.1100]], weight: 0.6 },
  { name: "Américas", pts: [[4.6250, -74.1050], [4.6220, -74.1300], [4.6180, -74.1500], [4.6050, -74.1650], [4.5978, -74.1616]], weight: 0.7 },
  { name: "Suba", pts: [[4.7400, -74.0850], [4.7300, -74.0950], [4.7200, -74.1050], [4.7100, -74.0700]], weight: 0.7 },
  { name: "Chapinero / 93", pts: [[4.6766, -74.0483], [4.6650, -74.0580], [4.6580, -74.0620], [4.6486, -74.0620]], weight: 0.8 },
];

const PLACE_LABELS = ["Portal Norte", "Calle 100", "Calle 72", "Parque de la 93", "Marly", "Universidades", "Ricaurte", "Portal Sur", "Portal Suba", "Museo del Oro", "Av. Jiménez", "Portal Américas", "Banderas", "Portal 80", "Héroes", "Calle 45"];

export function analyticsMock<T>(path: string, q: Record<string, unknown>, init: { method: string; body: string | null; headers: Record<string, string> }): T {
  // public ingestion
  if (/^\/v1\/cities\/[^/]+\/events$/.test(path)) {
    if (init.method !== "POST") throw new ApiRequestError(405, "METHOD_NOT_ALLOWED", "POST only");
    let batch: AnalyticsBatch;
    try {
      batch = JSON.parse(init.body ?? "{}") as AnalyticsBatch;
    } catch {
      throw new ApiRequestError(400, "BAD_REQUEST", "body must be JSON");
    }
    if (!Array.isArray(batch.events) || batch.events.length > 50) throw new ApiRequestError(400, "BAD_REQUEST", "events must be an array of ≤ 50");
    receivedEvents.push(batch);
    return { accepted: batch.events.length, rejected: [] } as AnalyticsAccepted as T;
  }
  const m = path.match(/^\/v1\/admin\/cities\/([^/]+)\/analytics\/([a-z.]+)$/);
  if (!m) throw new ApiRequestError(404, "NOT_FOUND", `No mock for ${path}`);
  const from = String(q.from ?? "2026-08-30"), to = String(q.to ?? "2026-09-05");
  const days = daysBetween(from, to);
  const r = rng(seedOf(from, to));
  const scale = days * 180; // ~180 sessions/day in the demo city
  const range = { from, to };
  const n = (base: number, jitter = 0.15) => Math.round(base * scale * (1 + (r() - 0.5) * 2 * jitter));
  const kpi = (v: number) => ({ value: v, previous: Math.round(v * (0.82 + r() * 0.3)) });

  switch (m[2]) {
    case "summary": {
      const sessions = n(1), plans = n(0.62), selects = n(0.41), go = n(0.12), goDone = Math.round(n(0.12) * 0.7), handoffs = n(0.05);
      const s: AnalyticsSummary = {
        range, kThreshold: K,
        kpis: { sessions: kpi(sessions), planRequests: kpi(plans), itinerarySelects: kpi(selects), goStarts: kpi(go), goCompletions: kpi(goDone), handoffs: kpi(handoffs), activeDays: { value: days, previous: days } },
        topModes: modes(r, scale),
        topRoutes: routes(r, scale),
        topStops: stops(r, scale),
        platforms: [{ platform: "ios", sessions: Math.round(sessions * 0.46) }, { platform: "android", sessions: Math.round(sessions * 0.38) }, { platform: "web", sessions: Math.round(sessions * 0.16) }],
        versions: [{ appVersion: "1.4.3", sessions: Math.round(sessions * 0.71) }, { appVersion: "1.4.2", sessions: Math.round(sessions * 0.2) }, { appVersion: "web", sessions: Math.round(sessions * 0.09) }],
        lastRollupAt: new Date(Date.now() - 6 * 60_000).toISOString(),
      };
      return s as T;
    }
    case "od": {
      const features: AnalyticsOdResponse["cells"]["features"] = [];
      for (const c of CORRIDORS) for (const [lat, lon] of c.pts) {
        for (let k = 0; k < 3; k++) {
          const la = lat + (r() - 0.5) * 0.006, lo = lon + (r() - 0.5) * 0.006;
          const origins = Math.max(K, Math.round(c.weight * scale * 0.02 * (0.4 + r())));
          features.push({ type: "Feature", geometry: { type: "Polygon", coordinates: cellPolygon(la, lo) }, properties: { gh7: cellId(la, lo), origins, destinations: Math.max(K, Math.round(origins * (0.6 + r() * 0.8))), searches: Math.max(K, Math.round(origins * (0.3 + r() * 0.5))) } });
        }
      }
      const pairsSrc: [[number, number], [number, number], number][] = [
        [[4.7546, -74.0459], [4.6120, -74.0800], 1.0], [[4.7546, -74.0459], [4.6766, -74.0483], 0.8], [[4.7400, -74.0850], [4.6486, -74.0620], 0.7],
        [[4.5978, -74.1616], [4.6120, -74.0800], 0.7], [[4.6841, -74.0517], [4.6000, -74.0830], 0.5], [[4.6766, -74.0483], [4.6300, -74.0750], 0.5],
        [[4.7050, -74.0500], [4.6250, -74.1050], 0.4], [[4.6500, -74.1200], [4.6120, -74.0800], 0.4], [[4.7215, -74.0466], [4.6650, -74.0580], 0.3], [[4.6180, -74.1500], [4.6120, -74.0800], 0.3],
      ];
      const pairs = pairsSrc.map(([a, b, w]) => ({ fromGh7: cellId(a[0], a[1]), toGh7: cellId(b[0], b[1]), fromCenter: [a[1], a[0]] as [number, number], toCenter: [b[1], b[0]] as [number, number], n: Math.max(K, Math.round(w * scale * 0.03 * (0.8 + r() * 0.4))) })).sort((x, y) => y.n - x.n);
      return { cells: { type: "FeatureCollection", features }, pairs, kThreshold: K } as AnalyticsOdResponse as T;
    }
    case "places": {
      const kind = (q.kind as "origin" | "destination" | "search") ?? "origin";
      const places = PLACE_LABELS.map((label, i) => {
        const c = CORRIDORS[i % CORRIDORS.length].pts[i % 4] ?? CORRIDORS[0].pts[0];
        return { gh7: cellId(c[0], c[1]), center: [c[1], c[0]] as [number, number], label, n: Math.max(K, Math.round(scale * 0.05 * (1 - i * 0.05) * (0.8 + r() * 0.4))) };
      }).sort((a, b) => b.n - a.n);
      return { kind, places } as AnalyticsPlacesResponse as T;
    }
    case "routes":
      return { routes: routes(r, scale) } as AnalyticsRoutesResponse as T;
    case "stops":
      return { stops: stops(r, scale) } as AnalyticsStopsResponse as T;
    case "modes":
      return { modes: modes(r, scale) } as AnalyticsModesResponse as T;
    case "searches": {
      const types = ["station", "stop", "poi", "place", "address"];
      const searches = PLACE_LABELS.map((label, i) => ({ resultType: i < 8 ? "station" : types[i % types.length], resultId: i < 10 ? `bogota:${2000 + i * 17}` : null, label: i < 12 ? label : null, n: Math.max(K, Math.round(scale * 0.06 * (1 - i * 0.05) * (0.8 + r() * 0.4))) })).sort((a, b) => b.n - a.n);
      return { searches } as AnalyticsSearchesResponse as T;
    }
    case "providers": {
      const handoffs = n(0.05);
      return { providers: [{ providerId: "taxi", handoffs: Math.round(handoffs * 0.44), hadEstimate: Math.round(handoffs * 0.44) }, { providerId: "uber", handoffs: Math.round(handoffs * 0.31), hadEstimate: 0 }, { providerId: "cabify", handoffs: Math.round(handoffs * 0.11), hadEstimate: 0 }, { providerId: "didi", handoffs: Math.round(handoffs * 0.09), hadEstimate: 0 }, { providerId: "indrive", handoffs: Math.round(handoffs * 0.05), hadEstimate: 0 }] } as AnalyticsProvidersResponse as T;
    }
    case "funnel": {
      const out: AnalyticsFunnelResponse["days"] = [];
      const start = Date.parse(from);
      for (let d = 0; d < days; d++) {
        const day = new Date(start + d * 86_400_000).toISOString().slice(0, 10);
        const wd = new Date(start + d * 86_400_000).getUTCDay();
        const f = wd === 0 ? 0.55 : wd === 6 ? 0.7 : 1;
        const opens = Math.round(210 * f * (0.85 + r() * 0.3)), sessions = Math.round(opens * 0.86), plans = Math.round(sessions * 0.62), sel = Math.round(plans * 0.66), go = Math.round(sel * 0.3), done = Math.round(go * 0.7);
        out.push({ day, appOpens: opens, sessions, planRequests: plans, itinerarySelects: sel, goStarts: go, goCompletions: done });
      }
      const totals = out.reduce((a, d) => ({ appOpens: a.appOpens + d.appOpens, sessions: a.sessions + d.sessions, planRequests: a.planRequests + d.planRequests, itinerarySelects: a.itinerarySelects + d.itinerarySelects, goStarts: a.goStarts + d.goStarts, goCompletions: a.goCompletions + d.goCompletions }), { appOpens: 0, sessions: 0, planRequests: 0, itinerarySelects: 0, goStarts: 0, goCompletions: 0 });
      return { days: out, totals } as AnalyticsFunnelResponse as T;
    }
    case "hours": {
      const cells: AnalyticsHoursResponse["cells"] = [];
      for (let wd = 0; wd < 7; wd++) for (let h = 0; h < 24; h++) {
        const weekend = wd >= 5;
        const peak = weekend ? Math.exp(-((h - 12) ** 2) / 20) * 0.5 : Math.exp(-((h - 7) ** 2) / 4) + Math.exp(-((h - 17.5) ** 2) / 6) * 0.9 + 0.12;
        cells.push({ weekday: wd, hour: h, planRequests: Math.round(peak * scale * 0.012 * (0.8 + r() * 0.4)) });
      }
      return { cells } as AnalyticsHoursResponse as T;
    }
    case "export.csv": {
      const dataset = String(q.dataset ?? "routes");
      const rows: (string | number)[][] = dataset === "routes" ? [["routeId", "shortName", "views", "selects", "locates"], ...routes(r, scale).map((x) => [x.routeId, x.shortName ?? "", x.views, x.selects, x.locates])] : dataset === "stops" ? [["stopId", "name", "views", "boards", "locates"], ...stops(r, scale).map((x) => [x.stopId, x.name ?? "", x.views, x.boards, x.locates])] : dataset === "modes" ? [["modeSet", "requests", "selects"], ...modes(r, scale).map((x) => [x.modeSet, x.requests, x.selects])] : [["note"], ["aggregate export (mock)"]];
      return rows.map((row) => row.map((v) => (typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v))).join(",")).join("\n") as T;
    }
  }
  throw new ApiRequestError(404, "NOT_FOUND", `No mock for ${path}`);
}

function modes(r: () => number, scale: number) {
  const base = [["BUS,WALK", 0.58], ["BUS,CABLE_CAR,WALK", 0.06], ["BICYCLE_RENTAL,BUS,WALK", 0.11], ["BICYCLE,WALK", 0.05], ["CAR_ONDEMAND", 0.07], ["BUS,CAR_ONDEMAND,WALK", 0.04], ["WALK", 0.09]] as const;
  return base.map(([modeSet, w]) => {
    const requests = Math.round(scale * 0.62 * w * (0.85 + r() * 0.3));
    return { modeSet, requests, selects: Math.round(requests * (0.5 + r() * 0.3)) };
  });
}
function routes(r: () => number, scale: number) {
  const base = [["bogota:12873", "G12", "trunk"], ["bogota:12842", "B75", "trunk"], ["bogota:12814", "B13", "trunk"], ["bogota:12646", "H75", "trunk"], ["bogota:10930", "2-2", "feeder"], ["bogota:12576", "J74", "trunk"], ["bogota:20010", "HA611", "zonal"], ["bogota:12612", "B28", "trunk"], ["bogota:11033", "2-7", "feeder"], ["bogota:12558", "H13", "trunk"], ["bogota:20500", "T62", "zonal"], ["bogota:20601", "K916", "zonal"]] as const;
  return base.map(([routeId, shortName, component], i) => {
    const views = Math.round(scale * 0.09 * (1 - i * 0.06) * (0.85 + r() * 0.3));
    return { routeId, shortName, component, views, selects: Math.round(views * (0.3 + r() * 0.3)), locates: Math.round(views * (0.2 + r() * 0.3)) };
  });
}
function stops(r: () => number, scale: number) {
  const base = [["bogota:2000", "Portal Norte"], ["bogota:2300", "Calle 100"], ["bogota:2200", "Calle 72"], ["bogota:5000", "Portal Sur"], ["bogota:2500", "Héroes"], ["bogota:3100", "Ricaurte"], ["bogota:4100", "Portal Américas"], ["bogota:6000", "Portal Suba"], ["bogota:3200", "Av. Jiménez"], ["bogota:2400", "Calle 76"]] as const;
  return base.map(([stopId, name], i) => {
    const views = Math.round(scale * 0.08 * (1 - i * 0.07) * (0.85 + r() * 0.3));
    return { stopId, name, views, boards: Math.round(views * (0.5 + r() * 0.3)), locates: Math.round(views * (0.2 + r() * 0.3)) };
  });
}
