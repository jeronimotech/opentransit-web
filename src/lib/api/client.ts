import type {
  AdminConfigPatch,
  AdminConfigResponse,
  AdminHistoryResponse,
  AdminMe,
  AdminSession,
  AdminUserCreate,
  AdminUserPatch,
  AdminUserRow,
  AlertsResponse,
  AnalyticsAccepted,
  AnalyticsBatch,
  AnalyticsDataset,
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
  ApiError,
  ApiErrorDetail,
  BoardResponse,
  City,
  CityHealth,
  DeparturesResponse,
  ForecastResponse,
  GeocodeResponse,
  Healthz,
  LandingResponse,
  Mode,
  NearbyResponse,
  NetworkResponse,
  NextResponse,
  OnDemandEstimateResponse,
  OnDemandHandoffResponse,
  OnDemandProvidersResponse,
  PlanParams,
  PoiCollection,
  PlanResponse,
  RentalNetworksResponse,
  RentalStationDetail,
  RentalStationsResponse,
  ReverseResponse,
  ShareCreated,
  SharedEta,
  ShareProgress,
  RouteDetail,
  RoutesResponse,
  StopDetail,
  VehicleDetail,
  VehicleFrame,
} from "./types";

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001"
).replace(/\/$/, "");

export const MOCK = process.env.NEXT_PUBLIC_MOCK === "1";

/** Same-origin route handler that holds the admin session cookie (src/app/api/admin). */
const ADMIN_PROXY = "/api/admin";

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details: ApiErrorDetail[];
  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function qs(q?: Query): string {
  if (!q) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === "") continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let body: ApiError | null = null;
    try {
      body = (await res.json()) as ApiError;
    } catch {
      /* not json */
    }
    throw new ApiRequestError(
      res.status,
      body?.error?.code ?? "HTTP_ERROR",
      body?.error?.message ?? `${res.status} ${res.statusText}`,
      body?.error?.details ?? [],
    );
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

function mock<T>(path: string, q?: Query, init?: RequestInit): Promise<T> {
  return import("@/mocks/handlers").then(({ mockRequest }) =>
    mockRequest<T>(path, q ?? {}, {
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : null,
      headers: (init?.headers ?? {}) as Record<string, string>,
    }),
  );
}

async function request<T>(path: string, q?: Query, init?: RequestInit): Promise<T> {
  if (MOCK) return mock<T>(path, q, init);
  return fetchJson<T>(`${API_URL}${path}${qs(q)}`, init);
}

/**
 * Admin calls go to this app's own `/api/admin` proxy, never straight to the API: the session lives in
 * an httpOnly cookie on this origin, so nothing here has to hold — or could leak — a credential.
 */
async function adminRequest<T>(path: string, q?: Query, init?: RequestInit): Promise<T> {
  if (MOCK) return mock<T>(path, q, init);
  return fetchJson<T>(`${ADMIN_PROXY}${path.replace(/^\/v1\/admin/, "")}${qs(q)}`, init);
}

const c = (city: string) => `/v1/cities/${encodeURIComponent(city)}`;

export const api = {
  healthz: () => request<Healthz>("/healthz"),
  cities: () => request<{ cities: City[] }>("/v1/cities"),
  city: (city: string) => request<City>(c(city)),

  plan: (city: string, p: PlanParams) =>
    request<PlanResponse>(`${c(city)}/plan`, {
      fromLat: p.fromLat,
      fromLon: p.fromLon,
      toLat: p.toLat,
      toLon: p.toLon,
      time: p.time,
      arriveBy: p.arriveBy,
      modes: p.modes?.join(","),
      wheelchair: p.wheelchair,
      numItineraries: p.numItineraries,
      maxWalkDistance: p.maxWalkDistance,
      locale: p.locale,
      fromName: p.fromName,
      toName: p.toName,
      onDemand: p.onDemand || undefined,
    }),

  /** v1.7 — "Cuándo salir": the same trip planned across a window, one row per departure. */
  planForecast: (
    city: string,
    p: { fromLat: number; fromLon: number; toLat: number; toLon: number; modes?: Mode[]; windowMinutes?: number; maxOptions?: number; arriveBy?: boolean; locale?: "es" | "en" },
  ) =>
    request<ForecastResponse>(`${c(city)}/plan/forecast`, {
      fromLat: p.fromLat,
      fromLon: p.fromLon,
      toLat: p.toLat,
      toLon: p.toLon,
      modes: p.modes?.join(","),
      windowMinutes: p.windowMinutes ?? 90,
      maxOptions: p.maxOptions ?? 8,
      arriveBy: p.arriveBy || undefined,
      locale: p.locale,
    }),

  /** v1.7 — shared ETA. `writeKey` comes back once; only its holder may patch or revoke. */
  shareCreate: (city: string, body: { itinerary: unknown; startedAt: string; label?: string }) =>
    request<ShareCreated>(`${c(city)}/share/eta`, undefined, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  shareRead: (city: string, token: string) =>
    request<SharedEta>(`${c(city)}/share/eta/${encodeURIComponent(token)}`, undefined, { cache: "no-store" }),
  shareProgress: (city: string, token: string, writeKey: string, progress: ShareProgress) =>
    request<SharedEta>(`${c(city)}/share/eta/${encodeURIComponent(token)}`, undefined, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Share-Key": writeKey },
      body: JSON.stringify({ progress }),
    }),
  shareRevoke: (city: string, token: string, writeKey: string) =>
    request<null>(`${c(city)}/share/eta/${encodeURIComponent(token)}`, undefined, {
      method: "DELETE",
      headers: { "X-Share-Key": writeKey },
    }),

  geocode: (city: string, q: string, near?: { lat: number; lon: number }, limit = 8, locale?: "es" | "en") =>
    request<GeocodeResponse>(`${c(city)}/geocode`, {
      q,
      lat: near?.lat,
      lon: near?.lon,
      limit,
      // A stop's label carries one word of UI text ("Estación" / "Station"); without
      // this the API answers in the city's language whoever is reading.
      locale,
    }),
  reverse: (city: string, lat: number, lon: number) =>
    request<ReverseResponse>(`${c(city)}/reverse`, { lat, lon }),

  stopsNearby: (city: string, lat: number, lon: number, radius = 500, limit = 30, include?: ("stops" | "rental")[]) =>
    request<NearbyResponse>(`${c(city)}/stops/nearby`, { lat, lon, radius, limit, include: include?.join(",") }),

  /** v1.2 — shared bikes (GBFS): networks, stations in view, one station. */
  rentalNetworks: (city: string) => request<RentalNetworksResponse>(`${c(city)}/rental/networks`),
  rentalStations: (city: string, bbox?: string, networkId?: string, limit = 500) =>
    request<RentalStationsResponse>(`${c(city)}/rental/stations`, { bbox, networkId, limit }),
  rentalStation: (city: string, id: string) => request<RentalStationDetail>(`${c(city)}/rental/stations/${encodeURIComponent(id)}`),

  /** v1.4 — on-demand (taxi / ride-hailing): public providers, a price/time estimate, and the hand-off URL builder. */
  onDemandProviders: (city: string) => request<OnDemandProvidersResponse>(`${c(city)}/ondemand/providers`),
  onDemandEstimate: (city: string, p: { fromLat: number; fromLon: number; toLat: number; toLon: number; time?: string; providerId?: string }) =>
    request<OnDemandEstimateResponse>(`${c(city)}/ondemand/estimate`, p),
  onDemandHandoff: (city: string, p: { providerId: string; fromLat: number; fromLon: number; toLat: number; toLon: number; fromName?: string; toName?: string; platform?: "ios" | "android" | "web" }) =>
    request<OnDemandHandoffResponse>(`${c(city)}/ondemand/handoff`, p),
  /** The same hand-off as a navigable URL (`?redirect=1` → 302 into the provider). */
  onDemandHandoffUrl: (city: string, p: { providerId: string; fromLat: number; fromLon: number; toLat: number; toLon: number; fromName?: string; toName?: string; platform?: "ios" | "android" | "web" }) =>
    `${API_URL}${c(city)}/ondemand/handoff${qs({ ...p, redirect: 1 })}`,
  stop: (city: string, stopId: string) =>
    request<StopDetail>(`${c(city)}/stops/${encodeURIComponent(stopId)}`),
  departures: (city: string, stopId: string, limit = 20, minutes = 60) =>
    request<DeparturesResponse>(
      `${c(city)}/stops/${encodeURIComponent(stopId)}/departures`,
      { limit, minutes },
    ),

  /** v1.1 — arrival board grouped by route (stations aggregate their platforms). */
  board: (city: string, stopId: string, minutes = 60, perRoute = 3) =>
    request<BoardResponse>(`${c(city)}/stops/${encodeURIComponent(stopId)}/board`, { minutes, perRoute }),
  /** v1.1 — "Ubica tu bus": next buses of one route at one stop, live first. */
  nextBuses: (city: string, stopId: string, routeId: string, limit = 3) =>
    request<NextResponse>(
      `${c(city)}/stops/${encodeURIComponent(stopId)}/routes/${encodeURIComponent(routeId)}/next`,
      { limit },
    ),
  /** v1.1 — station services (bike parking, toilets…) as GeoJSON. */
  pois: (city: string, bbox: string, types?: string[]) =>
    request<PoiCollection>(`${c(city)}/pois`, { bbox, type: types?.join(",") }),

  routes: (city: string, component?: string, q?: string) =>
    request<RoutesResponse>(`${c(city)}/routes`, { component, q }),
  route: (city: string, routeId: string) =>
    request<RouteDetail>(`${c(city)}/routes/${encodeURIComponent(routeId)}`),
  network: (city: string) => request<NetworkResponse>(`${c(city)}/network`),

  vehicles: (
    city: string,
    f?: { routeId?: string; component?: string; bbox?: string },
  ) => request<VehicleFrame>(`${c(city)}/vehicles`, f),
  vehicle: (city: string, id: string) =>
    request<VehicleDetail>(`${c(city)}/vehicles/${encodeURIComponent(id)}`),
  vehicleStreamUrl: (city: string, f?: { bbox?: string; routeIds?: string[] }) =>
    `${API_URL}${c(city)}/vehicles/stream${qs({ deltas: true, bbox: f?.bbox, routeIds: f?.routeIds?.join(",") })}`,

  alerts: (city: string, f?: { routeId?: string; stopId?: string; active?: boolean }) =>
    request<AlertsResponse>(`${c(city)}/alerts`, f),
  health: (city: string) => request<CityHealth>(`${c(city)}/health`),
  /** v1.3 — white-label landing page content + live stats (404 LANDING_DISABLED when off). */
  landing: (city: string, init?: RequestInit) => request<LandingResponse>(`${c(city)}/landing`, undefined, init),
  /** v1.5 — anonymous usage/mobility events, fire-and-forget (≤ 50 per batch). */
  events: (city: string, batch: AnalyticsBatch) =>
    request<AnalyticsAccepted>(`${c(city)}/events`, undefined, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
      keepalive: true,
    }),
};

/* ── Admin: operator endpoints, authenticated by the session cookie ───────── */

const a = (city: string) => `/v1/admin/cities/${encodeURIComponent(city)}/config`;
const adminInit = (method = "GET", body?: unknown): RequestInit => ({
  method,
  headers: body !== undefined ? { "Content-Type": "application/json" } : {},
  body: body !== undefined ? JSON.stringify(body) : undefined,
});

export const adminApi = {
  login: (email: string, password: string) =>
    adminRequest<AdminSession>("/v1/admin/auth/login", undefined, adminInit("POST", { email, password })),
  logout: () => adminRequest<{ ok: true }>("/v1/admin/auth/logout", undefined, adminInit("POST")),
  me: () => adminRequest<AdminMe>("/v1/admin/auth/me"),
  users: () => adminRequest<{ users: AdminUserRow[] }>("/v1/admin/users"),
  createUser: (body: AdminUserCreate) => adminRequest<AdminUserRow>("/v1/admin/users", undefined, adminInit("POST", body)),
  updateUser: (id: number, body: AdminUserPatch) =>
    adminRequest<AdminUserRow>(`/v1/admin/users/${id}`, undefined, adminInit("PATCH", body)),
  disableUser: (id: number) =>
    adminRequest<AdminUserRow>(`/v1/admin/users/${id}/disable`, undefined, adminInit("POST")),

  config: (city: string) => adminRequest<AdminConfigResponse>(a(city), undefined, adminInit()),
  update: (city: string, patch: AdminConfigPatch) =>
    adminRequest<AdminConfigResponse>(a(city), undefined, adminInit("PUT", patch)),
  reset: (city: string) => adminRequest<AdminConfigResponse | null>(a(city), undefined, adminInit("DELETE")),
  history: (city: string, limit = 20) =>
    adminRequest<AdminHistoryResponse>(`${a(city)}/history`, { limit }, adminInit()),
};

/* ── Admin analytics (v1.5): aggregated, k-anonymous reads ───────────────── */

import { normalizeFunnel, normalizeHours, normalizeModes, normalizeOd, normalizePlaces, normalizeProviders, normalizeRoutes, normalizeSearches, normalizeStops, normalizeSummary } from "@/lib/analytics/normalize";

const an = (city: string) => `/v1/admin/cities/${encodeURIComponent(city)}/analytics`;
type Range = { from: string; to: string };

export const analyticsApi = {
  // every read goes through a normalizer: the server's dialect (camel/snake, kpis/totals) never reaches the UI
  summary: (city: string, r: Range): Promise<AnalyticsSummary> => adminRequest<unknown>(`${an(city)}/summary`, r, adminInit()).then(normalizeSummary),
  od: (city: string, r: Range, limit = 500): Promise<AnalyticsOdResponse> => adminRequest<unknown>(`${an(city)}/od`, { ...r, limit }, adminInit()).then(normalizeOd),
  places: (city: string, r: Range, kind: "origin" | "destination" | "search"): Promise<AnalyticsPlacesResponse> =>
    adminRequest<unknown>(`${an(city)}/places`, { ...r, kind }, adminInit()).then(normalizePlaces),
  routes: (city: string, r: Range): Promise<AnalyticsRoutesResponse> => adminRequest<unknown>(`${an(city)}/routes`, r, adminInit()).then((x) => ({ routes: normalizeRoutes(x) })),
  stops: (city: string, r: Range): Promise<AnalyticsStopsResponse> => adminRequest<unknown>(`${an(city)}/stops`, r, adminInit()).then((x) => ({ stops: normalizeStops(x) })),
  modes: (city: string, r: Range): Promise<AnalyticsModesResponse> => adminRequest<unknown>(`${an(city)}/modes`, r, adminInit()).then((x) => ({ modes: normalizeModes(x) })),
  searches: (city: string, r: Range): Promise<AnalyticsSearchesResponse> => adminRequest<unknown>(`${an(city)}/searches`, r, adminInit()).then(normalizeSearches),
  providers: (city: string, r: Range): Promise<AnalyticsProvidersResponse> => adminRequest<unknown>(`${an(city)}/providers`, r, adminInit()).then(normalizeProviders),
  funnel: (city: string, r: Range): Promise<AnalyticsFunnelResponse> => adminRequest<unknown>(`${an(city)}/funnel`, r, adminInit()).then(normalizeFunnel),
  hours: (city: string, r: Range): Promise<AnalyticsHoursResponse> => adminRequest<unknown>(`${an(city)}/hours`, r, adminInit()).then(normalizeHours),
  /** CSV download: the path the tab fetches through the proxy, then turns into a blob. */
  exportPath: (city: string, dataset: AnalyticsDataset, r: Range) => `${an(city)}/export.csv${qs({ dataset, ...r })}`,
  exportCsv: async (city: string, dataset: AnalyticsDataset, r: Range): Promise<string> => {
    if (MOCK) return mock<string>(`${an(city)}/export.csv`, { dataset, ...r });
    // Not JSON, so it bypasses adminRequest — but it goes through the same proxy, with the same cookie.
    const res = await fetch(`${ADMIN_PROXY}${analyticsApi.exportPath(city, dataset, r).replace(/^\/v1\/admin/, "")}`);
    if (!res.ok) throw new ApiRequestError(res.status, "HTTP_ERROR", `${res.status} ${res.statusText}`);
    return res.text();
  },
};

export const ALL_MODES: Mode[] = ["BUS", "CABLE_CAR", "RAIL", "SUBWAY", "TRAM", "BICYCLE"];
