/**
 * The admin analytics API ships two dialects: the contract (camelCase, `kpis`, `routes`…)
 * and the first server implementation (snake_case, `totals`/`previousTotals`, `items`,
 * an hours matrix). These normalizers accept either and always return the contract types,
 * so the tab never crashes on a key it did not expect.
 */
import type {
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

type J = Record<string, unknown>;
const obj = (v: unknown): J => (v && typeof v === "object" && !Array.isArray(v) ? (v as J) : {});
const arr = (v: unknown): J[] => (Array.isArray(v) ? (v as J[]) : []);
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v: unknown): string | null => (typeof v === "string" ? v : v == null ? null : String(v));
/** first present key, camel or snake */
const pick = (o: J, ...keys: string[]): unknown => {
  for (const k of keys) if (o[k] !== undefined) return o[k];
  return undefined;
};

const KPI_KEYS = ["sessions", "planRequests", "itinerarySelects", "goStarts", "goCompletions", "handoffs", "activeDays"] as const;
const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

export function normalizeModes(raw: unknown): AnalyticsModesResponse["modes"] {
  const list = arr(pick(obj(raw), "modes", "items", "topModes"));
  return list.map((m) => ({ modeSet: str(pick(m, "modeSet", "mode_set")) ?? "", requests: num(m.requests), selects: num(m.selects) }));
}
export function normalizeRoutes(raw: unknown): AnalyticsRoutesResponse["routes"] {
  const list = arr(pick(obj(raw), "routes", "items", "topRoutes"));
  return list.map((r) => ({ routeId: str(pick(r, "routeId", "route_id")) ?? "", shortName: str(pick(r, "shortName", "short_name")), component: str(r.component), views: num(r.views), selects: num(r.selects), locates: num(r.locates) }));
}
export function normalizeStops(raw: unknown): AnalyticsStopsResponse["stops"] {
  const list = arr(pick(obj(raw), "stops", "items", "topStops"));
  return list.map((s) => ({ stopId: str(pick(s, "stopId", "stop_id")) ?? "", name: str(s.name), views: num(s.views), boards: num(s.boards), locates: num(s.locates) }));
}

export function normalizeSummary(raw: unknown): AnalyticsSummary {
  const o = obj(raw);
  const kpisIn = obj(pick(o, "kpis"));
  const totals = obj(pick(o, "totals"));
  const prev = obj(pick(o, "previousTotals", "previous_totals"));
  const kpis = Object.fromEntries(
    KPI_KEYS.map((k) => {
      const c = obj(kpisIn[k]);
      const value = kpisIn[k] !== undefined ? num(c.value) : num(pick(totals, k, snake(k)));
      const previous = kpisIn[k] !== undefined ? (c.previous == null ? null : num(c.previous)) : prev[k] !== undefined || prev[snake(k)] !== undefined ? num(pick(prev, k, snake(k))) : null;
      return [k, { value, previous }];
    }),
  ) as AnalyticsSummary["kpis"];
  const range = obj(pick(o, "range", "period"));
  const platforms = arr(pick(o, "platforms")).map((p) => ({ platform: (str(p.platform) ?? "web") as AnalyticsSummary["platforms"][number]["platform"], sessions: num(p.sessions) }));
  const versions = arr(pick(o, "versions")).map((v) => ({ appVersion: str(pick(v, "appVersion", "app_version")) ?? "?", sessions: num(v.sessions) }));
  return {
    range: { from: str(range.from) ?? "", to: str(range.to) ?? "" },
    kThreshold: num(pick(o, "kThreshold", "k_threshold"), 5),
    kpis,
    topModes: normalizeModes({ modes: pick(o, "topModes", "top_modes") }),
    topRoutes: normalizeRoutes({ routes: pick(o, "topRoutes", "top_routes") }),
    topStops: normalizeStops({ stops: pick(o, "topStops", "top_stops") }),
    platforms,
    versions,
    lastRollupAt: str(pick(o, "lastRollupAt", "last_rollup_at")),
  };
}

export function normalizeOd(raw: unknown): AnalyticsOdResponse {
  const o = obj(raw);
  const cells = obj(o.cells);
  const features = arr(cells.features).map((f) => {
    const p = obj(f.properties);
    return { type: "Feature" as const, geometry: obj(f.geometry) as AnalyticsOdResponse["cells"]["features"][number]["geometry"], properties: { gh7: str(p.gh7) ?? "", origins: num(p.origins), destinations: num(p.destinations), searches: num(p.searches) } };
  });
  const center = (v: unknown): [number, number] => {
    if (Array.isArray(v)) return [num(v[0]), num(v[1])];
    const c = obj(v);
    return [num(c.lon), num(c.lat)];
  };
  const pairs = arr(o.pairs).map((p) => ({ fromGh7: str(pick(p, "fromGh7", "from_gh7")) ?? "", toGh7: str(pick(p, "toGh7", "to_gh7")) ?? "", fromCenter: center(pick(p, "fromCenter", "from_center")), toCenter: center(pick(p, "toCenter", "to_center")), n: num(p.n) }));
  return { cells: { type: "FeatureCollection", features }, pairs, kThreshold: num(pick(o, "kThreshold", "k_threshold"), 5) };
}

export function normalizePlaces(raw: unknown): AnalyticsPlacesResponse {
  const o = obj(raw);
  const list = arr(pick(o, "places", "items"));
  return {
    kind: (str(o.kind) ?? "origin") as AnalyticsPlacesResponse["kind"],
    places: list.map((p) => {
      const c = p.center;
      const center: [number, number] = Array.isArray(c) ? [num(c[0]), num(c[1])] : [num(obj(c).lon), num(obj(c).lat)];
      return { gh7: str(p.gh7) ?? "", center, label: str(p.label), n: num(p.n) };
    }),
  };
}

export function normalizeSearches(raw: unknown): AnalyticsSearchesResponse {
  const list = arr(pick(obj(raw), "searches", "items"));
  return { searches: list.map((s) => ({ resultType: str(pick(s, "resultType", "result_type")) ?? "", resultId: str(pick(s, "resultId", "result_id")), label: str(s.label), n: num(s.n) })) };
}

export function normalizeProviders(raw: unknown): AnalyticsProvidersResponse {
  const list = arr(pick(obj(raw), "providers", "items"));
  return { providers: list.map((p) => ({ providerId: str(pick(p, "providerId", "provider_id")) ?? "", handoffs: num(p.handoffs), hadEstimate: num(pick(p, "hadEstimate", "had_estimate")) })) };
}

const FUNNEL_KEYS = ["appOpens", "sessions", "planRequests", "itinerarySelects", "goStarts", "goCompletions"] as const;
export function normalizeFunnel(raw: unknown): AnalyticsFunnelResponse {
  const o = obj(raw);
  const row = (d: J) => Object.fromEntries(FUNNEL_KEYS.map((k) => [k, num(pick(d, k, snake(k)))])) as Record<(typeof FUNNEL_KEYS)[number], number>;
  const days = arr(o.days).map((d) => ({ day: str(d.day) ?? "", ...row(d) }));
  const totals = o.totals ? row(obj(o.totals)) : days.reduce((a, d) => Object.fromEntries(FUNNEL_KEYS.map((k) => [k, a[k] + d[k]])) as Record<(typeof FUNNEL_KEYS)[number], number>, row({}));
  return { days, totals };
}

export function normalizeHours(raw: unknown): AnalyticsHoursResponse {
  const o = obj(raw);
  if (Array.isArray(o.cells)) return { cells: arr(o.cells).map((c) => ({ weekday: num(c.weekday), hour: num(c.hour), planRequests: num(pick(c, "planRequests", "plan_requests")) })) };
  // matrix dialect: planRequests[weekday][hour]
  const matrix = arr(pick(o, "planRequests", "plan_requests")) as unknown as number[][];
  const cells: AnalyticsHoursResponse["cells"] = [];
  matrix.forEach((rowV, weekday) => (Array.isArray(rowV) ? rowV : []).forEach((v, hour) => cells.push({ weekday, hour, planRequests: num(v) })));
  return { cells };
}
