import { describe, expect, it } from "vitest";
import { availabilityTone, bikeShareEnabled, buildPlanModes, formatAvailability, networkById, rentalLink, rentalModesFor, stationAgeSeconds } from "./rental";
import type { BikeShareNetwork, City } from "./api/types";

const tembici: BikeShareNetwork = {
  id: "tembici",
  name: "Tembici Bogotá",
  network: "tembici_bogota",
  gbfsUrl: "https://bogota.publicbikesystem.net/customer/gbfs/v3.0/gbfs.json",
  color: "#00A859",
  url: "https://tembici.com.co/",
  apps: { ios: "https://apps.apple.com/co/app/id1454932002", android: "https://play.google.com/store/apps/details?id=com.tembici.app" },
  pricingSummary: null,
  formFactors: ["bicycle"],
};

describe("buildPlanModes", () => {
  it("keeps transit modes and implies WALK", () => {
    expect(buildPlanModes(["BUS", "CABLE_CAR"])).toEqual(["BUS", "CABLE_CAR", "WALK"]);
  });
  it("adds BIKE_RENTAL with transit (access/egress) and alone (direct)", () => {
    expect(buildPlanModes(["BUS"], { rental: true })).toEqual(["BUS", "BIKE_RENTAL", "WALK"]);
    expect(buildPlanModes([], { rental: true })).toEqual(["BIKE_RENTAL", "WALK"]);
  });
  it("adds the person's own bike; WALK is implied only when neither WALK nor BICYCLE is chosen", () => {
    expect(buildPlanModes(["BUS", "WALK"], { bike: true })).toEqual(["BUS", "WALK", "BICYCLE"]);
    expect(buildPlanModes(["BUS"], { bike: true })).toEqual(["BUS", "BICYCLE"]);
    expect(buildPlanModes(["BICYCLE"])).toEqual(["BICYCLE"]);
  });
  it("adds SCOOTER_RENTAL only for scooter-only networks", () => {
    expect(rentalModesFor([tembici])).toEqual(["BIKE_RENTAL"]);
    expect(rentalModesFor([{ ...tembici, formFactors: ["bicycle", "scooter"] }])).toEqual(["BIKE_RENTAL"]);
    expect(rentalModesFor([{ ...tembici, formFactors: ["scooter"] }])).toEqual(["SCOOTER_RENTAL"]);
    expect(buildPlanModes(["BUS"], { rental: true, rentalModes: ["BIKE_RENTAL", "SCOOTER_RENTAL"] })).toContain("SCOOTER_RENTAL");
  });
  it("never duplicates modes", () => {
    expect(buildPlanModes(["BUS", "BUS", "WALK"], { rental: true })).toEqual(["BUS", "WALK", "BIKE_RENTAL"]);
  });
});

describe("formatAvailability", () => {
  it("formats bikes and docks in both languages", () => {
    expect(formatAvailability(6, 13, "es")).toBe("6 bicis · 13 puestos");
    expect(formatAvailability(1, 1, "es")).toBe("1 bici · 1 puesto");
    expect(formatAvailability(6, 13, "en")).toBe("6 bikes · 13 docks");
    expect(formatAvailability(0, 19, "es")).toBe("0 bicis · 19 puestos");
  });
  it("drops unknown halves", () => {
    expect(formatAvailability(null, 4, "es")).toBe("4 puestos");
    expect(formatAvailability(3, null, "en")).toBe("3 bikes");
    expect(formatAvailability(null, null)).toBe("");
  });
  it("tones: none / low / ok", () => {
    expect(availabilityTone(0)).toBe("none");
    expect(availabilityTone(null)).toBe("none");
    expect(availabilityTone(2)).toBe("low");
    expect(availabilityTone(7)).toBe("ok");
  });
});

describe("station freshness and links", () => {
  it("computes age in seconds, null when unknown", () => {
    const now = Date.parse("2026-09-04T12:00:30Z");
    expect(stationAgeSeconds("2026-09-04T12:00:00Z", now)).toBe(30);
    expect(stationAgeSeconds(null, now)).toBeNull();
    expect(stationAgeSeconds("nope", now)).toBeNull();
  });
  it("picks the store link per platform and falls back to the website", () => {
    expect(rentalLink(tembici, "ios")).toBe(tembici.apps!.ios);
    expect(rentalLink(tembici, "android")).toBe(tembici.apps!.android);
    expect(rentalLink(tembici, "other")).toBe("https://tembici.com.co/");
    expect(rentalLink({ ...tembici, url: null, apps: null }, "ios")).toBeNull();
  });
  it("enables the feature from networks or the legacy flag", () => {
    const base = { features: { bikeShare: false } } as unknown as City;
    expect(bikeShareEnabled(base)).toBe(false);
    expect(bikeShareEnabled({ ...base, mobility: { bikeShare: [tembici] } })).toBe(true);
    expect(bikeShareEnabled({ ...base, features: { bikeShare: true } } as unknown as City)).toBe(true);
  });
});

describe("several networks per city", () => {
  const scooters: BikeShareNetwork = { ...tembici, id: "patinetas", name: "Patinetas del Norte", network: "patinetas_norte", color: "#6A1B9A", formFactors: ["scooter"] };
  const city = { features: { bikeShare: false }, mobility: { bikeShare: [tembici, scooters] } } as unknown as City;
  it("offers both rental modes and resolves each network by id", () => {
    expect(rentalModesFor(city.mobility!.bikeShare)).toEqual(["BIKE_RENTAL", "SCOOTER_RENTAL"]);
    expect(buildPlanModes(["BUS"], { rental: true, rentalModes: rentalModesFor(city.mobility!.bikeShare) })).toEqual(["BUS", "BIKE_RENTAL", "SCOOTER_RENTAL", "WALK"]);
  });
  it("keeps each network's own colour and links", () => {
    expect(rentalLink(scooters, "other")).toBe("https://tembici.com.co/");
    expect(scooters.color).not.toBe(tembici.color);
  });
});

describe("networkById", () => {
  it("finds a network by id and returns null otherwise", () => {
    const city = { features: { bikeShare: false }, mobility: { bikeShare: [tembici] } } as unknown as City;
    expect(networkById(city, "tembici")?.name).toBe("Tembici Bogotá");
    expect(networkById(city, "nope")).toBeNull();
    expect(networkById(city, null)).toBeNull();
  });
});
