import type {
  AlertsResponse,
  ApiError,
  City,
  CityHealth,
  DeparturesResponse,
  GeocodeResponse,
  Healthz,
  Mode,
  NearbyResponse,
  NetworkResponse,
  PlanParams,
  PlanResponse,
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
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
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
    return mockRequest<T>(path, q ?? {});
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
    );
  }
  return (await res.json()) as T;
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

  stopsNearby: (city: string, lat: number, lon: number, radius = 500, limit = 30) =>
    request<NearbyResponse>(`${c(city)}/stops/nearby`, { lat, lon, radius, limit }),
  stop: (city: string, stopId: string) =>
    request<StopDetail>(`${c(city)}/stops/${encodeURIComponent(stopId)}`),
  departures: (city: string, stopId: string, limit = 20, minutes = 60) =>
    request<DeparturesResponse>(
      `${c(city)}/stops/${encodeURIComponent(stopId)}/departures`,
      { limit, minutes },
    ),

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
  vehicleStreamUrl: (city: string) => `${API_URL}${c(city)}/vehicles/stream?deltas=true`,

  alerts: (city: string, f?: { routeId?: string; stopId?: string; active?: boolean }) =>
    request<AlertsResponse>(`${c(city)}/alerts`, f),
  health: (city: string) => request<CityHealth>(`${c(city)}/health`),
};

export const ALL_MODES: Mode[] = ["BUS", "CABLE_CAR", "RAIL", "SUBWAY", "TRAM", "BICYCLE"];
