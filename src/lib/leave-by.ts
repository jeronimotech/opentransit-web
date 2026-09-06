import type { Itinerary } from "./api/types";

/**
 * Citymapper-style countdown: when do I have to leave to catch this itinerary?
 * leave-by = first transit departure − everything before it (walk, bike, wait).
 * Walk-only / bike-only / taxi-only itineraries can start any time → "leave now".
 */
export type LeaveBy = { kind: "now" | "in" | "departed" | "anytime"; minutes: number };

export function leaveByOf(it: Itinerary, now: number): LeaveBy {
  const firstTransit = it.legs.find((l) => l.transit);
  if (!firstTransit) return { kind: "anytime", minutes: 0 };
  // time budget before boarding: the itinerary start already includes the access walk
  const leaveAt = new Date(it.startTime).getTime();
  const diff = Math.round((leaveAt - now) / 60_000);
  if (diff < -1) return { kind: "departed", minutes: diff };
  if (diff <= 1) return { kind: "now", minutes: 0 };
  return { kind: "in", minutes: diff };
}

/** Keep the caller's order but push departed itineraries to the bottom (stable). */
export function demoteDeparted<T extends Itinerary>(list: T[], now: number): { list: T[]; departed: number } {
  const alive: T[] = [];
  const gone: T[] = [];
  for (const it of list) (leaveByOf(it, now).kind === "departed" ? gone : alive).push(it);
  return { list: [...alive, ...gone], departed: gone.length };
}
