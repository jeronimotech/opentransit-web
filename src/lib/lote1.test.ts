import { describe, expect, it } from "vitest";
import { demoteDeparted, leaveByOf } from "./leave-by";
import { groupByScenario } from "./scenarios";
import { retimeItinerary } from "./retime";
import type { Itinerary, Leg, NextBus } from "./api/types";

const T0 = Date.parse("2026-09-06T12:00:00-05:00");
const iso = (min: number) => new Date(T0 + min * 60_000).toISOString();

function leg(p: Partial<Leg> & { mode: Leg["mode"]; transit: boolean; start: number; end: number }): Leg {
  const { start, end, ...rest } = p;
  return {
    startTime: iso(start),
    endTime: iso(end),
    durationSeconds: (end - start) * 60,
    distanceMeters: p.distanceMeters ?? 500,
    from: { name: "A", lat: 0, lon: 0, stopId: p.transit ? "bogota:1" : null, stopCode: null, arrival: null, departure: iso(start), component: null },
    to: { name: "B", lat: 0, lon: 0, stopId: p.transit ? "bogota:2" : null, stopCode: null, arrival: iso(end), departure: null, component: null },
    route: p.transit ? { id: "bogota:R1", shortName: "R1", longName: "R1", color: "#f00", textColor: "#fff", mode: "BUS", agencyId: "1", component: "trunk" } : null,
    headsign: null,
    agency: null,
    tripId: "t1",
    realtime: false,
    realtimeState: "SCHEDULED",
    delaySeconds: null,
    geometry: { encoded: "", precision: 5 },
    intermediateStops: [{ name: "M", lat: 0, lon: 0, stopId: "bogota:9", stopCode: null, arrival: iso(start + 5), departure: iso(start + 5), component: null }],
    steps: [],
    alerts: [],
    ...rest,
  } as Leg;
}

function mk(id: string, o: Partial<Itinerary> & { legs: Leg[] }): Itinerary {
  const start = o.legs[0].startTime;
  const end = o.legs[o.legs.length - 1].endTime;
  return {
    id,
    startTime: start,
    endTime: end,
    durationSeconds: (Date.parse(end) - Date.parse(start)) / 1000,
    walkDistanceMeters: 500,
    walkTimeSeconds: 400,
    waitingTimeSeconds: 120,
    transfers: 0,
    fare: null,
    accessible: null,
    ...o,
  };
}

const transit = (id: string, start: number, dur: number, extra: Partial<Itinerary> = {}) =>
  mk(id, { legs: [leg({ mode: "WALK", transit: false, start, end: start + 5 }), leg({ mode: "BUS", transit: true, start: start + 5, end: start + dur })], ...extra });

describe("leave-by countdown", () => {
  it("counts down to the itinerary start, says now within a minute, departed after", () => {
    const a = transit("a", 10, 40);
    expect(leaveByOf(a, T0)).toEqual({ kind: "in", minutes: 10 });
    expect(leaveByOf(a, T0 + 9.6 * 60_000).kind).toBe("now");
    expect(leaveByOf(a, T0 + 13 * 60_000).kind).toBe("departed");
  });
  it("walk-only itineraries can leave any time", () => {
    const w = mk("w", { legs: [leg({ mode: "WALK", transit: false, start: 0, end: 20 })] });
    expect(leaveByOf(w, T0 + 60 * 60_000).kind).toBe("anytime");
  });
  it("demotes departed itineraries to the bottom, stable order", () => {
    const a = transit("a", 2, 40), b = transit("b", 30, 40), c = transit("c", 5, 40);
    const r = demoteDeparted([a, b, c], T0 + 10 * 60_000);
    expect(r.list.map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(r.departed).toBe(2);
  });
});

describe("scenario grouping", () => {
  it("puts every itinerary in exactly one section and orders sections", () => {
    const fast = transit("fast", 5, 40);
    const walkLess = transit("walkLess", 8, 55, { walkDistanceMeters: 100 });
    const noTransfer = transit("noTx", 6, 60, { transfers: 0 });
    const twoTx = transit("twoTx", 4, 45, { transfers: 2 });
    const bike = mk("bike", { legs: [leg({ mode: "BICYCLE", transit: false, start: 0, end: 30 })] });
    const taxi = mk("taxi", { legs: [leg({ mode: "CAR", transit: false, start: 0, end: 25, onDemand: { kind: "taxi", providers: [], recommendedProviderId: null } as never })], source: "ondemand" });
    const groups = groupByScenario([fast, walkLess, noTransfer, twoTx, bike, taxi]);
    const all = groups.flatMap((g) => [g.best, ...g.rest]).map((x) => x.id);
    expect(new Set(all).size).toBe(6);
    expect(all).toHaveLength(6);
    expect(groups.map((g) => g.scenario)).toEqual(["fastest", "lessWalking", "fewestTransfers", "bike", "ondemand"]);
    expect(groups[0].best.id).toBe("fast");
    expect(groups[1].best.id).toBe("walkLess");
  });
  it("offers 'cheapest' only when fares differ", () => {
    const a = transit("a", 5, 40, { fare: { amount: 3200, currency: "COP" } });
    const b = transit("b", 5, 42, { fare: { amount: 3200, currency: "COP" } });
    expect(groupByScenario([a, b]).some((g) => g.scenario === "cheapest")).toBe(false);
    const c = transit("c", 5, 44, { fare: { amount: 1000, currency: "COP" }, transfers: 1 });
    expect(groupByScenario([a, b, c]).some((g) => g.scenario === "cheapest")).toBe(true);
  });
});

describe("re-timing", () => {
  it("shifts the boarding leg and everything after it, keeps earlier legs", () => {
    const base = transit("a", 0, 40);
    const dep: NextBus = { minutes: 12, time: iso(17), source: "live", vehicle: null, stopsAway: 1, distanceMeters: 300, tripId: "t2" };
    const r = retimeItinerary(base, 1, dep);
    expect(r.deltaSeconds).toBe(12 * 60);
    expect(r.itinerary.legs[0].startTime).toBe(base.legs[0].startTime);
    expect(r.itinerary.legs[1].startTime).toBe(iso(17));
    expect(r.itinerary.legs[1].endTime).toBe(iso(52));
    expect(r.itinerary.legs[1].intermediateStops[0].arrival).toBe(iso(22));
    expect(r.itinerary.endTime).toBe(iso(52));
    expect(r.itinerary.durationSeconds).toBe(52 * 60);
    expect(r.itinerary.legs[1].realtime).toBe(true);
    expect(r.itinerary.legs[1].tripId).toBe("t2");
    expect(r.itinerary.waitingTimeSeconds).toBe(120 + 720);
  });
});
