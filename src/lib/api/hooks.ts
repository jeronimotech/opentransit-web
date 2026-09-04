"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { ApiRequestError, api } from "./client";
import type { Departure, PlanParams } from "./types";

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

export function useDepartures(city: string, stopId: string, refreshMs = 20_000) {
  return useQuery({
    queryKey: ["departures", city, stopId],
    queryFn: () => api.departures(city, stopId, 30, 90),
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
