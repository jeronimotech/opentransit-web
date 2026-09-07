import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  angleDiff,
  bboxForRadius,
  circleRing,
  formatDistance,
  nearbyVehicles,
  readPrefs,
  relativeMotion,
  widerRadius,
  writePrefs,
} from "./near-me";
import { createVehicleSubscription, shouldConnect, subscriptionKey, type SourceLike } from "./api/stream";
import type { Vehicle } from "./api/types";

const me = { lat: 4.6843, lon: -74.0579 }; // Calle 100

const bus = (p: Partial<Vehicle>): Vehicle => ({
  id: "v1",
  label: null,
  routeId: "r1",
  routeShortName: "B13",
  tripId: null,
  tripResolved: true,
  component: "trunk",
  lat: me.lat,
  lon: me.lon,
  bearing: null,
  timestamp: "2026-09-07T10:00:00-05:00",
  stopId: null,
  stopSequence: null,
  occupancy: null,
  ...p,
});

/** ~metres north of a point, good enough for test fixtures. */
const north = (m: number) => me.lat + m / 111_320;

describe("bbox from centre + radius", () => {
  it("encloses the whole circle", () => {
    const [minLon, minLat, maxLon, maxLat] = bboxForRadius(me, 600);
    for (const [lon, lat] of circleRing(me, 600, 32)) {
      expect(lon).toBeGreaterThanOrEqual(minLon);
      expect(lon).toBeLessThanOrEqual(maxLon);
      expect(lat).toBeGreaterThanOrEqual(minLat);
      expect(lat).toBeLessThanOrEqual(maxLat);
    }
  });

  it("grows with the radius", () => {
    const small = bboxForRadius(me, 300);
    const big = bboxForRadius(me, 1000);
    expect(big[2] - big[0]).toBeGreaterThan(small[2] - small[0]);
  });

  // Snapping to a grid cannot promise that *any* single step keeps the box (a
  // point sitting on a boundary will cross it), so assert what it does promise:
  // a walk produces a handful of subscriptions, not one per GPS fix.
  it("re-subscribes a handful of times over a walk, not on every fix", () => {
    const seen = new Set<string>();
    for (let m = 0; m <= 300; m += 10) seen.add(bboxForRadius({ lat: north(m), lon: me.lon }, 600).join(","));
    expect(seen.size).toBeLessThanOrEqual(4); // 31 fixes over 300 m
    expect(seen.size).toBeGreaterThan(0);
  });

  it("does move once the user has walked a meaningful distance", () => {
    const a = bboxForRadius(me, 600);
    const b = bboxForRadius({ lat: north(400), lon: me.lon }, 600);
    expect(b).not.toEqual(a);
  });
});

describe("distance and nearby selection", () => {
  it("keeps buses inside the radius, nearest first, and drops the rest", () => {
    const near = bus({ id: "near", lat: north(100) });
    const mid = bus({ id: "mid", lat: north(400) });
    const far = bus({ id: "far", lat: north(2000) });
    const rows = nearbyVehicles([far, mid, near], me, 600);
    expect(rows.map((r) => r.vehicle.id)).toEqual(["near", "mid"]);
    expect(rows[0].distanceMeters).toBeLessThan(rows[1].distanceMeters);
    expect(Math.round(rows[0].distanceMeters)).toBe(100);
  });

  it("applies the component filter, and an empty filter means all", () => {
    const trunk = bus({ id: "t", component: "trunk", lat: north(50) });
    const zonal = bus({ id: "z", component: "zonal", lat: north(60) });
    expect(nearbyVehicles([trunk, zonal], me, 600).map((r) => r.vehicle.id)).toEqual(["t", "z"]);
    expect(nearbyVehicles([trunk, zonal], me, 600, new Set(["zonal"])).map((r) => r.vehicle.id)).toEqual(["z"]);
  });

  it("formats distance in metres, then kilometres", () => {
    expect(formatDistance(4)).toBe("a menos de 10 m");
    expect(formatDistance(243)).toBe("a 240 m");
    expect(formatDistance(999)).toBe("a 1000 m");
    expect(formatDistance(1500)).toBe("a 1.5 km");
  });

  it("offers the next radius up until the widest", () => {
    expect(widerRadius(300)).toBe(600);
    expect(widerRadius(600)).toBe(1000);
    expect(widerRadius(1000)).toBeNull();
  });
});

describe("approaching / away", () => {
  // A bus due north of me heading south (180°) is coming towards me.
  it("calls a bus pointed at me approaching", () => {
    expect(relativeMotion(bus({ lat: north(200), bearing: 180 }), me)).toBe("approaching");
  });

  it("calls a bus pointed away from me away", () => {
    expect(relativeMotion(bus({ lat: north(200), bearing: 0 }), me)).toBe("away");
  });

  it("says nothing about a bus crossing sideways rather than guessing", () => {
    expect(relativeMotion(bus({ lat: north(200), bearing: 90 }), me)).toBeNull();
  });

  it("omits the arrow entirely when the frame carries no bearing", () => {
    expect(relativeMotion(bus({ lat: north(200), bearing: null }), me)).toBeNull();
    const rows = nearbyVehicles([bus({ lat: north(200), bearing: null })], me, 600);
    expect(rows[0].motion).toBeNull();
  });

  it("measures the smallest angle across the 0/360 wrap", () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(0, 180)).toBe(180);
  });
});

describe("preferences persistence", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  it("round-trips the radius and component filter per city", () => {
    writePrefs("bogota", { radius: 1000, components: ["zonal"] });
    expect(readPrefs("bogota")).toEqual({ radius: 1000, components: ["zonal"] });
    expect(readPrefs("medellin").radius).toBe(600); // untouched city keeps the default
  });

  it("falls back to the default when the stored value is nonsense", () => {
    localStorage.setItem("opentransit.bogota.nearme", JSON.stringify({ radius: 42, components: "no" }));
    expect(readPrefs("bogota")).toEqual({ radius: 600, components: [] });
  });
});

describe("stream subscription", () => {
  it("keys on the bbox, so a radius change re-subscribes instead of filtering client-side", () => {
    const a = subscriptionKey("bogota", { bbox: "-74.1,4.6,-74.0,4.7" });
    const b = subscriptionKey("bogota", { bbox: "-74.2,4.5,-73.9,4.8" });
    expect(a).not.toBe(b);
    expect(subscriptionKey("bogota", { bbox: "-74.1,4.6,-74.0,4.7" })).toBe(a);
  });

  it("does not connect while the tab is hidden, when the caller asked to pause", () => {
    expect(shouldConnect(true, false, true)).toBe(true);
    expect(shouldConnect(true, true, true)).toBe(false);
    expect(shouldConnect(true, true, false)).toBe(true); // other pages keep streaming
    expect(shouldConnect(false, false, true)).toBe(false);
  });

  it("closes the socket and cancels the retry when the subscription is torn down", () => {
    const closed: string[] = [];
    const sources: SourceLike[] = [];
    const make = (url: string): SourceLike => {
      const s: SourceLike = {
        onmessage: null,
        onerror: null,
        close: () => closed.push(url),
      };
      sources.push(s);
      return s;
    };
    const timers: Array<() => void> = [];
    const sub = createVehicleSubscription({
      url: "u1",
      createSource: make,
      onEvent: () => {},
      onStatus: () => {},
      setTimer: (fn) => {
        timers.push(fn);
        return timers.length;
      },
      clearTimer: (h) => void (timers[(h as number) - 1] = () => {}),
    });

    expect(sources).toHaveLength(1);
    sub.close();
    expect(closed).toEqual(["u1"]);

    // A retry queued before closing must not resurrect the connection.
    sources[0].onerror?.();
    for (const fn of timers) fn();
    expect(sources).toHaveLength(1);
  });

  it("reconnects after an error while it is still open", () => {
    const sources: SourceLike[] = [];
    const make = (): SourceLike => {
      const s: SourceLike = { onmessage: null, onerror: null, close: () => {} };
      sources.push(s);
      return s;
    };
    const timers: Array<() => void> = [];
    const sub = createVehicleSubscription({
      url: "u1",
      createSource: make,
      onEvent: () => {},
      onStatus: () => {},
      setTimer: (fn) => {
        timers.push(fn);
        return timers.length;
      },
      clearTimer: () => {},
    });
    sources[0].onerror?.();
    timers.pop()?.();
    expect(sources).toHaveLength(2);
    sub.close();
  });
});
