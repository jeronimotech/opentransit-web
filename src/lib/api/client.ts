import type {
  AdminConfigPatch,
  AdminConfigResponse,
  AdminHistoryResponse,
  AdminMe,
  AlertsResponse,
  ApiError,
  ApiErrorDetail,
  BoardResponse,
  City,
  CityHealth,
  DeparturesResponse,
  GeocodeResponse,
  Healthz,
  LandingResponse,
  Mode,
  NearbyResponse,
  NetworkResponse,
  NextResponse,
  PlanParams,
  PoiCollection,
  PlanResponse,
  RentalNetworksResponse,
  RentalStationDetail,
  RentalStationsResponse,
  ReverseResponse,
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

async function request<T>(path: string, q?: Query, init?: RequestInit): Promise<T> {
  if (MOCK) {
    const { mockRequest } = await import("@/mocks/handlers");
    return mockRequest<T>(path, q ?? {}, {
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : null,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
  }
  const res = await fetch(`${API_URL}${path}${qs(q)}`, {
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
    }),

  geocode: (city: string, q: string, near?: { lat: number; lon: number }, limit = 8) =>
    request<GeocodeResponse>(`${c(city)}/geocode`, {
      q,
      lat: near?.lat,
      lon: near?.lon,
      limit,
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
};

/* ── Admin: token-authenticated operator endpoints ───────────────────────── */

const a = (city: string) => `/v1/admin/cities/${encodeURIComponent(city)}/config`;
const adminInit = (token: string, method = "GET", body?: unknown): RequestInit => ({
  method,
  headers: {
    "X-Admin-Token": token,
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
  },
  body: body !== undefined ? JSON.stringify(body) : undefined,
});

export const adminApi = {
  me: (token: string) => request<AdminMe>("/v1/admin/me", undefined, adminInit(token)),
  config: (token: string, city: string) => request<AdminConfigResponse>(a(city), undefined, adminInit(token)),
  update: (token: string, city: string, patch: AdminConfigPatch) =>
    request<AdminConfigResponse>(a(city), undefined, adminInit(token, "PUT", patch)),
  reset: (token: string, city: string) =>
    request<AdminConfigResponse | null>(a(city), undefined, adminInit(token, "DELETE")),
  history: (token: string, city: string, limit = 20) =>
    request<AdminHistoryResponse>(`${a(city)}/history`, { limit }, adminInit(token)),
};

export const ALL_MODES: Mode[] = ["BUS", "CABLE_CAR", "RAIL", "SUBWAY", "TRAM", "BICYCLE"];
