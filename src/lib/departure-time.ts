import type { Departure } from "./api/types";

/**
 * The time to show for a departure.
 *
 * `scheduledTime` is null when a predicted arrival was never paired with a scheduled
 * one — which happens for a feed whose trip ids are not the schedule's, and is the
 * honest answer rather than inventing a timetable entry. The API guarantees
 * `realtimeTime` is set in that case, so one of the two is always present.
 */
export function departureTime(d: Pick<Departure, "realtimeTime" | "scheduledTime">): string {
  return d.realtimeTime ?? d.scheduledTime ?? "";
}

/** Stable key for a row: a predicted arrival has no trip and no scheduled time. */
export function departureKey(d: Pick<Departure, "tripId" | "realtimeTime" | "scheduledTime">): string {
  return `${d.tripId ?? "rt"}-${departureTime(d)}`;
}
