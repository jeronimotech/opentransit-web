import { describe, expect, it } from "vitest";
import { availabilityAgeSeconds, curbsEnabled, isParkRide, parkRideEnabled, parkingSummary, parkingTone } from "./parking";
import type { City, Itinerary } from "./api/types";

const city = (om: City["openMobility"]) => ({ openMobility: om } as unknown as City);
const PR = { enabled: true, maxDriveKm: 25, maxWalkMeters: 600, defaultDwellHours: 8 };

describe("gating", () => {
  it("offers curbs and park & ride only when the city publishes them", () => {
    expect(curbsEnabled(undefined)).toBe(false);
    expect(curbsEnabled(city({ cds: { enabled: false } }))).toBe(false);
    expect(curbsEnabled(city({ cds: { enabled: true } }))).toBe(true);
    // curbs without the feature flag: a map layer, but no "Carro + bus" toggle
    expect(parkRideEnabled(city({ cds: { enabled: true } }))).toBe(false);
    expect(parkRideEnabled(city({ cds: { enabled: true }, parkRide: PR }))).toBe(true);
    expect(parkRideEnabled(city({ cds: { enabled: false }, parkRide: PR }))).toBe(false);
  });
});

describe("parkingTone", () => {
  it("reads the count the way a driver would", () => {
    expect(parkingTone({ availableSpaces: 29, totalSpaces: 44, allowed: true })).toBe("ok");
    expect(parkingTone({ availableSpaces: 2, totalSpaces: 44, allowed: true })).toBe("low");
    expect(parkingTone({ availableSpaces: 2, totalSpaces: 2, allowed: true })).toBe("ok"); // tiny zone, all free
    expect(parkingTone({ availableSpaces: 5, totalSpaces: 44, allowed: true })).toBe("low"); // under a fifth
    expect(parkingTone({ availableSpaces: 0, totalSpaces: 8, allowed: true })).toBe("full");
    expect(parkingTone({ availableSpaces: null, totalSpaces: null, allowed: true })).toBe("unknown");
    // outside the hours you may not park, whatever the count says
    expect(parkingTone({ availableSpaces: 29, totalSpaces: 44, allowed: false })).toBe("closed");
    // no policy speaks of cars: the count is still the count
    expect(parkingTone({ availableSpaces: 29, totalSpaces: 44, allowed: null })).toBe("ok");
  });
});

describe("summary and freshness", () => {
  it("fits on one line, in both languages", () => {
    expect(parkingSummary({ name: "Und1414", availableSpaces: 29, totalSpaces: 44 }, "es")).toBe("Und1414 · 29 de 44 cupos");
    expect(parkingSummary({ name: "Und1414", availableSpaces: 29, totalSpaces: 44 }, "en")).toBe("Und1414 · 29 of 44 spaces");
    expect(parkingSummary({ name: null, availableSpaces: null, totalSpaces: null }, "es")).toBe("Parqueo");
  });
  it("says how old the count is, because PIM's is not live", () => {
    const now = Date.parse("2026-09-14T20:00:00Z");
    expect(availabilityAgeSeconds("2026-09-14T16:48:44+00:00", now)).toBe(11476);
    expect(availabilityAgeSeconds(null, now)).toBeNull();
  });
  it("recognises a park & ride itinerary by any of its marks", () => {
    const base = { legs: [{ mode: "CAR" }] } as unknown as Itinerary;
    expect(isParkRide(base)).toBe(false);
    expect(isParkRide({ ...base, source: "parkride" })).toBe(true);
    expect(isParkRide({ ...base, legs: [{ mode: "CAR", parkRide: true }] } as unknown as Itinerary)).toBe(true);
  });
});
