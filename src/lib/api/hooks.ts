"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { ApiRequestError, api } from "./client";
import type { Departure, NearbyRentalStation, PlanParams } from "./types";

const HOUR = 60 * 60 * 1000;

/** Retry network/5xx once; a 4xx is an answer, not a glitch. */
export const retryPolicy = (count: number, err: unknown) =>
  !(err instanceof ApiRequestError && err.status < 500) && count < 1;

export const isNotFound = (err: unknown) => err instanceof ApiRequestError && err.status === 404;

export function useCities() {
  return useQuery({ queryKey: ["cities"], queryFn: api.cities, staleTime: HOUR });
}

export function useCity(city: string) {
  return useQuery({
    queryKey: ["city", city],
    queryFn: () => api.city(city),
    staleTime: HOUR,
  });
}

export function usePlan(city: string, p: PlanParams | null) {
  return useQuery({
    queryKey: ["plan", city, p],
    queryFn: () => api.plan(city, p as PlanParams),
    enabled: !!p,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useGeocode(city: string, q: string, near?: { lat: number; lon: number }) {
  return useQuery({
    queryKey: ["geocode", city, q, near?.lat, near?.lon],
    queryFn: () => api.geocode(city, q, near),
    enabled: q.trim().length >= 2,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useNearbyStops(
  city: string,
  pos: { lat: number; lon: number } | null,
  radius = 600,
) {
  return useQuery({
    queryKey: ["nearby", city, pos?.lat, pos?.lon, radius],
    queryFn: () => api.stopsNearby(city, pos!.lat, pos!.lon, radius, 40),
    enabled: !!pos,
    staleTime: 60_000,
  });
}

export function useStop(city: string, stopId: string) {
  return useQuery({
    queryKey: ["stop", city, stopId],
    queryFn: () => api.stop(city, stopId),
    staleTime: HOUR,
  });
}

/** v1.1 arrival board; a 404 means the API predates v1.1 or the stop has no times → caller falls back. */
export function useBoard(city: string, stopId: string, refreshMs = 20_000, enabled = true) {
  return useQuery({
    queryKey: ["board", city, stopId],
    queryFn: () => api.board(city, stopId, 90, 4),
    enabled,
    refetchInterval: (q) => (q.state.error ? false : refreshMs),
    retry: retryPolicy,
    staleTime: 10_000,
  });
}

export function useNextBuses(city: string, stopId: string | null, routeId: string | null, refreshMs = 15_000) {
  return useQuery({
    queryKey: ["next", city, stopId, routeId],
    queryFn: () => api.nextBuses(city, stopId!, routeId!, 4),
    enabled: !!stopId && !!routeId,
    refetchInterval: (q) => (q.state.error ? false : refreshMs),
    retry: retryPolicy,
    staleTime: 5_000,
  });
}

export function usePois(city: string, bbox: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["pois", city, bbox],
    queryFn: () => api.pois(city, bbox!),
    enabled: enabled && !!bbox,
    staleTime: 10 * 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useDepartures(city: string, stopId: string, refreshMs = 20_000, enabled = true) {
  return useQuery({
    queryKey: ["departures", city, stopId],
    queryFn: () => api.departures(city, stopId, 30, 90),
    enabled,
    // keep polling while it works; a 4xx (e.g. a station with no stop times) stays put
    refetchInterval: (q) => (q.state.error ? false : refreshMs),
    retry: retryPolicy,
    staleTime: 10_000,
  });
}

/**
 * Departures for several platforms at once (a station page whose children carry
 * the stop times). Results are merged and sorted by time; each row keeps its platform.
 */
export function useDeparturesMulti(city: string, stopIds: string[], refreshMs = 20_000) {
  const results = useQueries({
    queries: stopIds.map((id) => ({
      queryKey: ["departures", city, id],
      queryFn: () => api.departures(city, id, 20, 90),
      refetchInterval: refreshMs,
      retry: retryPolicy,
      staleTime: 10_000,
    })),
  });
  const rows: (Departure & { platform: string })[] = [];
  let generatedAt: string | null = null;
  for (const r of results) {
    if (!r.data) continue;
    generatedAt = generatedAt ?? r.data.generatedAt;
    for (const d of r.data.departures) rows.push({ ...d, platform: r.data.stop.name });
  }
  rows.sort((a, b) => new Date(a.realtimeTime ?? a.scheduledTime).getTime() - new Date(b.realtimeTime ?? b.scheduledTime).getTime());
  return {
    departures: rows.slice(0, 30),
    generatedAt,
    isLoading: results.some((r) => r.isLoading),
    isFetching: results.some((r) => r.isFetching),
  };
}

export function useNetwork(city: string, enabled = true) {
  return useQuery({
    queryKey: ["network", city],
    queryFn: () => api.network(city),
    enabled,
    staleTime: HOUR,
  });
}

export function useRoutes(city: string, component?: string, q?: string) {
  return useQuery({
    queryKey: ["routes", city, component ?? "", q ?? ""],
    queryFn: () => api.routes(city, component, q),
    staleTime: HOUR,
  });
}

export function useRoute(city: string, routeId: string) {
  return useQuery({
    queryKey: ["route", city, routeId],
    queryFn: () => api.route(city, routeId),
    staleTime: HOUR,
  });
}

export function useAlerts(city: string, f?: { routeId?: string; stopId?: string }) {
  return useQuery({
    queryKey: ["alerts", city, f?.routeId ?? "", f?.stopId ?? ""],
    queryFn: () => api.alerts(city, { ...f, active: true }),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useVehicle(city: string, id: string | null) {
  return useQuery({
    queryKey: ["vehicle", city, id],
    queryFn: () => api.vehicle(city, id!),
    enabled: !!id,
    refetchInterval: 15_000,
  });
}

export function useCityHealth(city: string) {
  return useQuery({
    queryKey: ["health", city],
    queryFn: () => api.health(city),
    refetchInterval: 60_000,
  });
}


/* ── v1.2 shared bikes (GBFS) ──────────────────────────────────────────────── */

export function useRentalNetworks(city: string, enabled = true) {
  return useQuery({
    queryKey: ["rental", "networks", city],
    queryFn: () => api.rentalNetworks(city),
    enabled,
    staleTime: 5 * 60_000,
    retry: retryPolicy,
  });
}

/** Stations in the viewport; the API caches GBFS itself (ttl ~30 s), so we poll at that pace. */
export function useRentalStations(city: string, bbox: string | null, enabled: boolean, networkId?: string) {
  return useQuery({
    queryKey: ["rental", "stations", city, bbox, networkId ?? ""],
    queryFn: () => api.rentalStations(city, bbox ?? undefined, networkId),
    enabled: enabled && !!bbox,
    staleTime: 20_000,
    refetchInterval: (q) => (q.state.error ? false : 30_000),
    retry: retryPolicy,
    placeholderData: (prev) => prev,
  });
}

export function useRentalStation(city: string, id: string | null) {
  return useQuery({
    queryKey: ["rental", "station", city, id],
    queryFn: () => api.rentalStation(city, id!),
    enabled: !!id,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: retryPolicy,
  });
}

/** Nearest bike-share stations (via `stops/nearby?include=rental`), tolerant of either response shape. */
export function useNearbyRental(city: string, pos: { lat: number; lon: number } | null, radius = 700, enabled = true) {
  return useQuery({
    queryKey: ["nearby-rental", city, pos?.lat, pos?.lon, radius],
    queryFn: async (): Promise<NearbyRentalStation[]> => {
      const r = await api.stopsNearby(city, pos!.lat, pos!.lon, radius, 40, ["rental"]);
      const inline = (r.stops as unknown as NearbyRentalStation[]).filter((s) => s.kind === "rental_station");
      return [...(r.rental ?? []), ...inline].sort((a, b) => a.distanceMeters - b.distanceMeters);
    },
    enabled: enabled && !!pos,
    staleTime: 30_000,
    refetchInterval: 45_000,
    retry: retryPolicy,
  });
}
