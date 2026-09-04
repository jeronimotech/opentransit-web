import type { Itinerary } from "./api/types";
import { estimateFare } from "./fare";
import type { CityFares } from "./api/types";

/** Result sorting chips (Maas-style). `default` keeps the router's order. */
export type SortKey = "default" | "fastest" | "fewestTransfers" | "lessWalking" | "cheapest" | "soonest";

export const SORT_KEYS: SortKey[] = ["default", "fastest", "fewestTransfers", "lessWalking", "cheapest", "soonest"];

export function sortItineraries(list: Itinerary[], key: SortKey, fares?: CityFares | null): Itinerary[] {
  if (key === "default") return list;
  const withIdx = list.map((it, i) => ({ it, i }));
  const by = (f: (it: Itinerary) => number) =>
    withIdx.sort((a, b) => f(a.it) - f(b.it) || a.i - b.i).map((x) => x.it);
  switch (key) {
    case "fastest":
      return by((it) => it.durationSeconds);
    case "fewestTransfers":
      return by((it) => it.transfers * 100_000 + it.durationSeconds);
    case "lessWalking":
      return by((it) => it.walkDistanceMeters);
    case "cheapest":
      return by((it) => (estimateFare(it, fares)?.amount ?? Number.MAX_SAFE_INTEGER) * 1_000_000 + it.durationSeconds);
    case "soonest":
      return by((it) => new Date(it.startTime).getTime());
  }
}
