import type { Itinerary, Leg, NextBus } from "./api/types";

/**
 * Re-time an itinerary client-side when the person picks another departure of the
 * same route at the boarding stop (Citymapper's "next departures" chips).
 * The chosen leg (and every leg after it) shifts by the same delta; legs before it
 * keep their times but the itinerary's waiting time grows. Geometry never changes.
 */
export type Retimed = { itinerary: Itinerary; legIndex: number; deltaSeconds: number; departure: NextBus };

export function retimeItinerary(it: Itinerary, legIndex: number, departure: NextBus): Retimed {
  const leg = it.legs[legIndex];
  const deltaMs = new Date(departure.time).getTime() - new Date(leg.startTime).getTime();
  const shift = (iso: string | null | undefined) => (iso ? new Date(new Date(iso).getTime() + deltaMs).toISOString() : iso);
  const legs: Leg[] = it.legs.map((l, i) => {
    if (i < legIndex) return l;
    const shifted: Leg = {
      ...l,
      startTime: shift(l.startTime) as string,
      endTime: shift(l.endTime) as string,
      from: { ...l.from, arrival: shift(l.from.arrival) ?? null, departure: shift(l.from.departure) ?? null },
      to: { ...l.to, arrival: shift(l.to.arrival) ?? null, departure: shift(l.to.departure) ?? null },
      intermediateStops: l.intermediateStops.map((s) => ({ ...s, arrival: shift(s.arrival) ?? null, departure: shift(s.departure) ?? null })),
    };
    if (i === legIndex) {
      shifted.realtime = departure.source === "live";
      shifted.realtimeState = departure.source === "live" ? "UPDATED" : "SCHEDULED";
      shifted.tripId = departure.tripId ?? l.tripId;
    }
    return shifted;
  });
  const deltaSeconds = Math.round(deltaMs / 1000);
  const endTime = shift(it.endTime) as string;
  const durationSeconds = Math.round((new Date(endTime).getTime() - new Date(it.startTime).getTime()) / 1000);
  return {
    itinerary: { ...it, legs, endTime, durationSeconds, waitingTimeSeconds: Math.max(0, it.waitingTimeSeconds + deltaSeconds) },
    legIndex,
    deltaSeconds,
    departure,
  };
}
