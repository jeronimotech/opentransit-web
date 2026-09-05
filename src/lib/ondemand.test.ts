import { describe, expect, it } from "vitest";
import {
  estimateTaxi,
  formatPriceRange,
  handoffHref,
  inNightWindow,
  isMaskedCredential,
  itineraryOnDemandTotal,
  legLeadPrice,
  localParts,
  onDemandEnabled,
  onDemandShape,
  pricedProviders,
  providerFallback,
  requestLabel,
  providersPayload,
  renderTemplate,
  sortProviders,
  surchargeApplies,
  templatePlaceholders,
  validateTemplate,
  withPlatform,
} from "./ondemand";
import { readPlanner, toPlanParams, writePlanner } from "./planner-params";
import { EN_MESSAGES, validateMobility } from "./admin/validate";
import type { City, Itinerary, Leg, OnDemandProvider, TaxiTariff } from "./api/types";

const tariff: TaxiTariff = {
  id: "t-2026",
  name: "Tarifa 2026",
  currency: "COP",
  flagFall: 4500,
  unitPrice: 159,
  unitMeters: 100,
  unitSeconds: 30,
  minimumFare: 8000,
  surcharges: [
    { id: "night", label: "Nocturno", amount: 3800, when: { nightFrom: "19:00", nightTo: "06:00", sundays: true, holidays: true } },
    { id: "airport", label: "Aeropuerto", amount: 8000, when: { zones: ["airport"] } },
    { id: "door", label: "Puerta a puerta", amount: 1500, when: { optional: true } },
  ],
  source: { label: "Decreto 042 de 2026", url: null },
  validFrom: "2026-02-12",
  note: null,
};

const provider = (id: string, order: number, extra: Partial<OnDemandProvider> = {}): OnDemandProvider => ({
  id,
  name: id.toUpperCase(),
  kind: "ridehail",
  color: "#112233",
  estimate: { kind: "none" },
  handoff: { kind: "url", web: `https://${id}.example.com/` },
  enabled: true,
  order,
  ...extra,
});

const labels = { flagFall: "Banderazo", distance: (u: number) => `${u} unidades`, minimum: "Mínima" };
const day = { hhmm: "10:00", weekday: 3 };

describe("taxi tariff calculator", () => {
  it("charges flag fall + ceil(distance/unit) × unit price", () => {
    const e = estimateTaxi(tariff, 5000, day, labels);
    expect(e.units).toBe(50);
    expect(e.amount).toBe(4500 + 50 * 159);
    expect(e.surchargesApplied).toEqual([]);
  });
  it("never goes below the minimum fare and shows the adjustment", () => {
    const e = estimateTaxi(tariff, 1000, day, labels);
    expect(e.amount).toBe(8000);
    expect(e.breakdown.at(-1)?.label).toBe("Mínima");
  });
  it("applies the night surcharge inside a window that wraps midnight, and on Sundays", () => {
    expect(estimateTaxi(tariff, 5000, { hhmm: "21:00", weekday: 3 }, labels).surchargesApplied).toEqual(["night"]);
    expect(estimateTaxi(tariff, 5000, { hhmm: "05:30", weekday: 3 }, labels).surchargesApplied).toEqual(["night"]);
    expect(estimateTaxi(tariff, 5000, { hhmm: "12:00", weekday: 0 }, labels).surchargesApplied).toEqual(["night"]);
    expect(estimateTaxi(tariff, 5000, { hhmm: "12:00", weekday: 2, holiday: true }, labels).surchargesApplied).toEqual(["night"]);
  });
  it("applies zone and optional surcharges only when the trip touches the zone / the rider opts in", () => {
    expect(estimateTaxi(tariff, 15000, { ...day, zones: ["airport"] }, labels).surchargesApplied).toEqual(["airport"]);
    expect(estimateTaxi(tariff, 15000, { ...day, optional: ["door"] }, labels).surchargesApplied).toEqual(["door"]);
    expect(estimateTaxi(tariff, 15000, day, labels).surchargesApplied).toEqual([]);
  });
  it("gives a ±10 % band rounded to hundreds", () => {
    const e = estimateTaxi(tariff, 5000, day, labels);
    expect(e.min).toBe(Math.round((e.amount * 0.9) / 100) * 100);
    expect(e.max).toBe(Math.round((e.amount * 1.1) / 100) * 100);
  });
  it("night window helpers", () => {
    expect(inNightWindow("23:59", "19:00", "06:00")).toBe(true);
    expect(inNightWindow("06:00", "19:00", "06:00")).toBe(false);
    expect(inNightWindow("18:59", "19:00", "06:00")).toBe(false);
    expect(inNightWindow("13:00", "12:00", "14:00")).toBe(true);
    expect(surchargeApplies(tariff.surcharges[0], { hhmm: "03:00", weekday: 1 })).toBe(true);
  });
  it("localParts reads the city's clock, not the machine's", () => {
    const p = localParts(new Date("2026-09-06T02:30:00Z"), "America/Bogota"); // 21:30 Saturday in Bogotá
    expect(p.hhmm).toBe("21:30");
    expect(p.weekday).toBe(6);
  });
});

describe("price formatting", () => {
  it("shows a band when min and max differ and a point otherwise", () => {
    expect(formatPriceRange({ amount: 20000, min: 18000, max: 22000, currency: "COP", estimated: true })).toMatch(/^≈ .*18\.000.*22\.000$/);
    expect(formatPriceRange({ amount: 20000, min: null, max: null, currency: "COP", estimated: true }, "en")).toMatch(/^≈ .*20,000$/);
    expect(formatPriceRange({ amount: 20000, min: 20000, max: 20000, currency: "COP", estimated: false }, "en")).toMatch(/^[^≈].*20,000$/);
  });
  it("returns null when there is no number (price in the app)", () => {
    expect(formatPriceRange(null)).toBeNull();
    expect(formatPriceRange({ amount: null, min: null, max: null, currency: "COP", estimated: true })).toBeNull();
  });
});

describe("provider ordering and gating", () => {
  it("sorts by order then name and drops disabled providers", () => {
    const list = [provider("b", 2), provider("a", 1), provider("c", 3, { enabled: false }), provider("d", 2, { name: "AAA" })];
    expect(sortProviders(list).map((p) => p.id)).toEqual(["a", "d", "b"]);
  });
  it("the chip is gated by the feature flag and by having providers", () => {
    const base = { features: { onDemand: true }, mobility: { bikeShare: [], onDemand: [provider("a", 1)] } } as unknown as City;
    expect(onDemandEnabled(base)).toBe(true);
    expect(onDemandEnabled({ ...base, features: { onDemand: false } } as unknown as City)).toBe(false);
    expect(onDemandEnabled({ ...base, mobility: { bikeShare: [], onDemand: [] } } as unknown as City)).toBe(false);
    expect(onDemandEnabled({ ...base, features: {}, mobility: { bikeShare: [], onDemand: [provider("a", 1, { enabled: false })] } } as unknown as City)).toBe(false);
    expect(onDemandEnabled(null)).toBe(false);
  });
  it("planner state round-trips the taxi flag and sends onDemand=true", () => {
    const s = readPlanner(new URLSearchParams("from=4.1,-74.1&to=4.2,-74.2&taxi=1"));
    expect(s.taxi).toBe(true);
    expect(writePlanner(s).get("taxi")).toBe("1");
    expect(toPlanParams(s, "es")?.onDemand).toBe(true);
    expect(toPlanParams({ ...s, taxi: false }, "es")?.onDemand).toBeUndefined();
  });
});

describe("hand-off", () => {
  it("builds a navigable hand-off: redirect=1, platform, endpoint names only when missing", () => {
    const rel = handoffHref("/v1/cities/x/ondemand/handoff?providerId=a&fromLat=4.1&fromLon=-74.1&toLat=4.2&toLon=-74.2", "ios", { fromName: "Chicó Norte", toName: "Portal Sur" })!;
    const q = new URLSearchParams(rel.split("?")[1]);
    expect(rel.startsWith("/v1/cities/x/ondemand/handoff?")).toBe(true);
    expect(q.get("redirect")).toBe("1");
    expect(q.get("platform")).toBe("ios");
    expect(q.get("fromName")).toBe("Chicó Norte");
    expect(q.get("toName")).toBe("Portal Sur");
    const abs = handoffHref("https://api.example.com/h?providerId=a&platform=web&fromName=Casa", "android", { fromName: "X", toName: "Y" })!;
    const qa = new URL(abs).searchParams;
    expect(qa.get("platform")).toBe("web");
    expect(qa.get("fromName")).toBe("Casa");
    expect(qa.get("toName")).toBe("Y");
    expect(qa.get("redirect")).toBe("1");
    expect(handoffHref(null, "web")).toBeNull();
  });
  it("adds the platform to API hand-off URLs and falls back to store/web links", () => {
    expect(withPlatform("/v1/cities/x/ondemand/handoff?providerId=a", "ios")).toBe("/v1/cities/x/ondemand/handoff?providerId=a&platform=ios");
    expect(withPlatform("https://api.example.com/h?providerId=a&platform=web", "ios")).toContain("platform=web");
    const p = provider("a", 1, { handoff: { kind: "url", web: "https://a.example.com/", apps: { ios: "https://apps.apple.com/a", android: null } } });
    expect(providerFallback(p, "ios")).toBe("https://apps.apple.com/a");
    expect(providerFallback(p, "android")).toBe("https://a.example.com/");
    expect(providerFallback(p, "web")).toBe("https://a.example.com/");
  });
  it("template placeholders: validates known ones, rejects unknown, renders url-encoded", () => {
    const tpl = "https://m.example.com/looking?client_id={clientId}&pickup={pickupJson}&drop[0]={dropoffJson}";
    expect(templatePlaceholders(tpl)).toEqual(["clientId", "pickupJson", "dropoffJson"]);
    expect(validateTemplate(tpl).ok).toBe(true);
    expect(validateTemplate("https://x.example.com/?a={nope}")).toMatchObject({ ok: false, unknown: ["nope"] });
    expect(validateTemplate("http://x.example.com/?a={pickupLat}").ok).toBe(false);
    expect(validateTemplate("https://x.example.com/").ok).toBe(false);
    const url = renderTemplate(tpl, { pickup: { lat: 4.1, lon: -74.1, name: "Calle 93" }, dropoff: { lat: 4.2, lon: -74.2, name: "Portal Sur" }, clientId: "abc" });
    expect(url).toContain("client_id=abc");
    expect(url).toContain(encodeURIComponent(JSON.stringify({ latitude: 4.1, longitude: -74.1, addressLine1: "Calle 93" })));
    expect(url).not.toContain("{");
  });
  it("PUT payload echoes masked client ids, sends edited ones plain and null when cleared", () => {
    const rows = [
      provider("a", 1, { credentials: { clientId: "••••1234" } }),
      provider("b", 2, { credentials: { clientId: "new-plain-id" } }),
      provider("c", 3, { credentials: { clientId: "" } }),
      provider("d", 4),
    ];
    expect(providersPayload(rows).map((p) => p.credentials)).toEqual([{ clientId: "••••1234" }, { clientId: "new-plain-id" }, { clientId: null }, { clientId: null }]);
    expect(providersPayload(rows).every((p) => "credentials" in p)).toBe(true);
  });
  it("recognises a masked credential", () => {
    expect(isMaskedCredential("••••1a2b")).toBe(true);
    expect(isMaskedCredential("****ab")).toBe(true);
    expect(isMaskedCredential("real-client-id")).toBe(false);
    expect(isMaskedCredential("")).toBe(false);
  });
});

describe("itinerary helpers", () => {
  const car = (price: number | null): Leg =>
    ({
      mode: "CAR",
      transit: false,
      onDemand: {
        kind: "taxi",
        recommendedProviderId: "taxi",
        providers: [
          { providerId: "uber", name: "U", color: "#000", price: null, waitSeconds: null, handoffUrl: null, source: "none" },
          { providerId: "taxi", name: "T", color: "#fc0", price: price == null ? null : { amount: price, min: price - 1000, max: price + 1000, currency: "COP", estimated: true }, waitSeconds: 300, handoffUrl: "/h", source: "tariff" },
        ],
      },
      legs: [],
    }) as unknown as Leg;
  const bus = { mode: "BUS", transit: true } as unknown as Leg;
  it("leads with the recommended priced provider and sums per itinerary", () => {
    const it = { legs: [car(20000)] } as unknown as Itinerary;
    expect(legLeadPrice(car(20000))?.provider.providerId).toBe("taxi");
    expect(itineraryOnDemandTotal(it)).toEqual({ min: 19000, max: 21000, currency: "COP" });
    expect(itineraryOnDemandTotal({ legs: [car(null)] } as unknown as Itinerary)).toBeNull();
  });
  it("lists priced providers cheapest first and builds the primary button label", () => {
    const leg = {
      mode: "CAR",
      onDemand: {
        kind: "mixed",
        recommendedProviderId: "taxi",
        providers: [
          { providerId: "app", name: "App", kind: "ridehail", color: "#000", price: { amount: 25000, min: null, max: null, currency: "COP", estimated: true }, waitSeconds: null, handoffUrl: null, source: "api" },
          { providerId: "taxi", name: "Taxi", kind: "taxi", color: "#fc0", price: { amount: 20000, min: 18000, max: 22000, currency: "COP", estimated: true }, waitSeconds: null, handoffUrl: null, source: "tariff" },
          { providerId: "none", name: "Other", kind: "ridehail", color: "#123", price: null, waitSeconds: null, handoffUrl: null, source: "none" },
        ],
      },
    } as unknown as Leg;
    expect(pricedProviders(leg).map((p) => p.providerId)).toEqual(["taxi", "app"]);
    const t = { request: "Pedir", requestWith: (n: string) => `Pedir con ${n}`, taxi: "Taxi" };
    expect(requestLabel({ name: "Taxi", kind: "taxi" }, "≈ $ 18.000–22.000", t)).toBe("Pedir taxi · ≈ $ 18.000–22.000");
    expect(requestLabel({ name: "App", kind: "ridehail" }, "≈ $ 25.000", t)).toBe("Pedir App · ≈ $ 25.000");
    expect(requestLabel({ name: "Uber", kind: "ridehail" }, null, t)).toBe("Pedir con Uber");
  });
  it("classifies direct vs combo", () => {
    expect(onDemandShape({ legs: [car(1)] } as unknown as Itinerary)).toBe("direct");
    expect(onDemandShape({ legs: [car(1), bus] } as unknown as Itinerary)).toBe("combo");
    expect(onDemandShape({ legs: [bus] } as unknown as Itinerary)).toBeNull();
  });
});

describe("admin validation (mobility v1.4)", () => {
  const ok = { bikeShare: [], taxiTariffs: [tariff], onDemand: [provider("taxi", 1, { kind: "taxi", estimate: { kind: "tariff", tariffId: "t-2026" } }), provider("app", 2, { handoff: { kind: "template", template: "https://m.example.com/?p={pickupJson}" } })], onDemandPolicy: { maxDirectDistanceKm: 40, firstLastMile: true, maxFeederKm: 8, showWhenTransitFaster: true } };
  it("accepts a well-formed configuration", () => {
    expect(validateMobility(ok, EN_MESSAGES)).toEqual({});
    expect(validateMobility({ ...ok, onDemandPolicy: { ...ok.onDemandPolicy, durationFactor: 1.4, nightDurationFactor: null } }, EN_MESSAGES)).toEqual({});
  });
  it("bounds the traffic factors to 1.0–3.0", () => {
    const e = validateMobility({ ...ok, onDemandPolicy: { ...ok.onDemandPolicy, durationFactor: 0.5, nightDurationFactor: 3.5 } }, EN_MESSAGES);
    expect(e["mobility.onDemandPolicy.durationFactor"]).toBe(EN_MESSAGES.factorRange);
    expect(e["mobility.onDemandPolicy.nightDurationFactor"]).toBe(EN_MESSAGES.factorRange);
  });
  it("flags bad tariff numbers, unknown tariff refs, bad templates and duplicate orders", () => {
    const e = validateMobility(
      {
        ...ok,
        taxiTariffs: [{ ...tariff, unitMeters: 0, minimumFare: -1, surcharges: [{ id: "x", label: "", amount: 1, when: { nightFrom: "25:00", nightTo: "06:00" } }] }],
        onDemand: [provider("taxi", 1, { kind: "taxi", estimate: { kind: "tariff", tariffId: "missing" } }), provider("app", 1, { handoff: { kind: "template", template: "https://m.example.com/?p={bogus}" }, color: "red" })],
      },
      EN_MESSAGES,
    );
    expect(e["mobility.taxiTariffs.0.unitMeters"]).toBe(EN_MESSAGES.positive);
    expect(e["mobility.taxiTariffs.0.minimumFare"]).toBe(EN_MESSAGES.nonNegative);
    expect(e["mobility.taxiTariffs.0.surcharges.0.label"]).toBe(EN_MESSAGES.required);
    expect(e["mobility.taxiTariffs.0.surcharges.0.when.nightFrom"]).toBe(EN_MESSAGES.hhmm);
    expect(e["mobility.onDemand.0.estimate.tariffId"]).toBe(EN_MESSAGES.tariffRef);
    expect(e["mobility.onDemand.1.handoff.template"]).toBe(EN_MESSAGES.template);
    expect(e["mobility.onDemand.1.color"]).toBe(EN_MESSAGES.hex);
    expect(e["mobility.onDemand.1.order"]).toBe(EN_MESSAGES.duplicateOrder);
  });
});
