import { describe, expect, it } from "vitest";
import { fareForTransfers, farePreview } from "./fare-preview";
import { EN_MESSAGES, errorsFromDetails, isHttpsUrl, validateConfig, validateFares, validateLinks, validateMobility, validateServices } from "./validate";
import { changedKeys, effectiveChanges, effectiveSection, fieldOverridden, flatten, sectionOverridden } from "./diff";
import type { AdminEditable, CityFares } from "../api/types";

const bogota: CityFares = { currency: "COP", base: 3200, transfer: 0, transferWindowMinutes: 110, maxTransfers: 2, note: null, estimated: true };

describe("fare preview rule", () => {
  it("matches the planner rule: transfers inside the window are cheap up to maxTransfers", () => {
    expect(fareForTransfers(bogota, 0)).toBe(3200);
    expect(fareForTransfers(bogota, 1)).toBe(3200);
    expect(fareForTransfers(bogota, 2)).toBe(3200);
    expect(fareForTransfers(bogota, 3)).toBe(6400); // third transfer starts a new trip
    expect(fareForTransfers(bogota, 5)).toBe(6400);
    expect(fareForTransfers(bogota, 6)).toBe(9600);
  });
  it("charges the transfer price when it is not free", () => {
    const paid = { ...bogota, transfer: 300, maxTransfers: 1 };
    expect(fareForTransfers(paid, 1)).toBe(3500);
    expect(fareForTransfers(paid, 2)).toBe(6700);
  });
  it("a transfer outside the window is a new base fare", () => {
    expect(fareForTransfers(bogota, 1, false)).toBe(6400);
  });
  it("preview lists 0..3 transfers inside the window plus one outside", () => {
    const rows = farePreview(bogota);
    expect(rows.map((r) => r.amount)).toEqual([3200, 3200, 3200, 6400, 6400]);
    expect(rows.at(-1)?.withinWindow).toBe(false);
  });
});

describe("validation", () => {
  it("accepts the Bogotá fares", () => {
    expect(validateFares(bogota, EN_MESSAGES)).toEqual({});
  });
  it("flags each fare rule", () => {
    const e = validateFares({ ...bogota, currency: "pesos", base: -1, transferWindowMinutes: 601, maxTransfers: 2.5 }, EN_MESSAGES);
    expect(Object.keys(e).sort()).toEqual(["fares.base", "fares.currency", "fares.maxTransfers", "fares.transferWindowMinutes"]);
  });
  it("checks config ranges, semver and the maintenance message", () => {
    const e = validateConfig(
      { vehiclePollSeconds: 3, departuresRefreshSeconds: 20, features: {}, minAppVersion: { ios: "1.0", android: "1.0.0" }, maintenance: { active: true, message: " " } },
      EN_MESSAGES,
    );
    expect(Object.keys(e).sort()).toEqual(["config.maintenance.message", "config.minAppVersion.ios", "config.vehiclePollSeconds"]);
  });
  it("links must be https or empty", () => {
    expect(isHttpsUrl("https://x.gov.co/a")).toBe(true);
    expect(isHttpsUrl("http://x.gov.co")).toBe(false);
    expect(validateLinks({ pqrs: "http://nope", support: null, recharge: "" }, EN_MESSAGES)).toEqual({ "links.pqrs": EN_MESSAGES.https });
  });
  it("services need slug ids, labels, https urls and a known kind", () => {
    const e = validateServices(
      [
        { id: "recharge", label: "Recargar", icon: "card", url: "https://tullaveplus.gov.co", kind: "external" },
        { id: "Recharge!", label: "", icon: "x", url: "ftp://x", kind: "other" as "external" },
        { id: "recharge", label: "Dup", icon: "x", url: "https://x.co", kind: "internal" },
      ],
      EN_MESSAGES,
    );
    expect(Object.keys(e).sort()).toEqual(["services.1.id", "services.1.kind", "services.1.label", "services.1.url", "services.2.id"]);
  });
  it("validates bike-share networks (N per city, unique ids, https gbfs.json, vehicle types)", () => {
    const ok = { id: "tembici", name: "Tembici Bogotá", network: "tembici_bogota", gbfsUrl: "https://bogota.publicbikesystem.net/customer/gbfs/v3.0/gbfs.json", color: "#00A859", url: "https://tembici.com.co/", apps: null, pricingSummary: null, formFactors: ["bicycle" as const] };
    const second = { ...ok, id: "patinetas", name: "Patinetas del Norte", network: "patinetas_norte", gbfsUrl: "https://example.org/gbfs/v3/gbfs.json", color: "#6A1B9A", formFactors: ["scooter" as const] };
    expect(validateMobility({ bikeShare: [ok, second] }, EN_MESSAGES)).toEqual({});
    const e = validateMobility({ bikeShare: [ok, { ...second, id: "tembici", gbfsUrl: "http://x", color: "green", formFactors: [] }] }, EN_MESSAGES);
    expect(Object.keys(e).sort()).toEqual(["mobility.bikeShare.1.color", "mobility.bikeShare.1.formFactors", "mobility.bikeShare.1.gbfsUrl", "mobility.bikeShare.1.id"]);
  });
  it("maps API details to local paths", () => {
    expect(errorsFromDetails([{ path: "fares.base", message: "x" }, { path: "services[1].url", message: "y" }])).toEqual({ "fares.base": "x", "services.1.url": "y" });
  });
  it("falls back to parsing 'path: message' out of the API message", () => {
    expect(errorsFromDetails(undefined, "fares.currency: String should match pattern '^[A-Z]{3}$'; fares.base: must be ≥ 0")).toEqual({
      "fares.currency": "String should match pattern '^[A-Z]{3}$'",
      "fares.base": "must be ≥ 0",
    });
    expect(errorsFromDetails(undefined, "validation failed")).toEqual({});
  });
});

describe("overrides and history diff", () => {
  const yaml: AdminEditable = { fares: bogota, config: null, links: { pqrs: "https://a" }, services: [], branding: { primaryColor: "#D32F2F" }, mobility: null };
  it("detects section and field overrides", () => {
    const override = { fares: { ...bogota, base: 3400 } };
    expect(sectionOverridden(override, "fares")).toBe(true);
    expect(sectionOverridden(override, "links")).toBe(false);
    expect(fieldOverridden(override, yaml, "fares", "base")).toBe(true);
    expect(fieldOverridden(override, yaml, "fares", "transfer")).toBe(false);
    expect(effectiveSection(override, yaml, "fares")?.base).toBe(3400);
    expect(effectiveSection(null, yaml, "fares")?.base).toBe(3200);
  });
  it("summarises what changed between two revisions", () => {
    const prev = { fares: { ...bogota, base: 3200 } };
    const next = { fares: { ...bogota, base: 3400 }, branding: { primaryColor: "#000000" } };
    const ch = changedKeys(prev, next);
    expect(ch.map((c) => `${c.kind}:${c.path}`)).toEqual(["added:branding.primaryColor", "changed:fares.base"]);
    expect(changedKeys(next, null).every((c) => c.kind === "removed")).toBe(true);
  });
  it("history shows effective changes, so the first revision is a single edit", () => {
    const first = effectiveChanges(null, { fares: { ...bogota, base: 3400 } }, yaml);
    expect(first.map((c) => `${c.kind}:${c.path}`)).toEqual(["changed:fares.base"]);
    const back = effectiveChanges({ fares: { ...bogota, base: 3400 } }, null, yaml);
    expect(back).toEqual([{ path: "fares.base", kind: "changed", from: 3400, to: 3200 }]);
  });
  it("flattens arrays with indexes", () => {
    expect(flatten({ services: [{ id: "a" }] })).toEqual({ "services.0.id": "a" });
  });
});
