import { describe, expect, it } from "vitest";
import { fareForTransfers, farePreview } from "./fare-preview";
import { EN_MESSAGES, errorsFromDetails, isHttpsUrl, validateConfig, validateFares, validateLinks, validateMobility, validateSection, validateServices } from "./validate";
import { changedKeys, effectiveChanges, effectiveSection, fieldOverridden, flatten, sectionOverridden } from "./diff";
import type { AdminEditable, AdminOverride, AssistantConfig, CityConfig, CityFares, CityLanding, CityLinks, CityMobility } from "../api/types";

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
  const yaml: AdminEditable = { fares: bogota, config: null, links: { pqrs: "https://a" }, services: [], branding: { primaryColor: "#D32F2F" }, mobility: null, landing: null };
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

/* ── a partial override is a patch, not a whole section ──────────────────── */

describe("partial overrides", () => {
  // What a real city looks like: the YAML holds everything, the override holds
  // only what an operator changed. Bogotá's is literally
  // {config: {assistant: {enabled: true, apiKey: null}}}.
  const yamlFull: AdminEditable = {
    fares: bogota,
    config: {
      vehiclePollSeconds: 15,
      departuresRefreshSeconds: 30,
      features: { liveVehicles: true, board: true, bike: true },
      minAppVersion: { ios: "1.4.0", android: "1.4.0" },
      maintenance: { active: false, message: null },
      assistant: {
        enabled: false,
        provider: "deepseek",
        model: null,
        apiKey: "••••1a2b", // masked: the real one lives in the environment
        baseUrl: null,
        maxRepliesPerSession: 30,
        maxToolCallsPerReply: 6,
        dailyBudgetUsd: 5,
        rateLimitPerMinute: 6,
        systemExtra: null,
        logConversations: false,
      },
    },
    links: { pqrs: "https://pqrs.example", recharge: "https://recarga.example" },
    services: [{ id: "recharge", label: "Recargar", url: "https://recarga.example", icon: null }],
    branding: { primaryColor: "#D32F2F" },
    mobility: {
      bikeShare: [{ id: "tembici", name: "Tembici", network: "tembici_bogota", gbfsUrl: "https://gbfs.example/gbfs.json", color: "#00A66C", formFactors: ["bicycle"] }],
    },
    landing: {
      enabled: true,
      slug: "bogota",
      locale: "es",
      theme: { primaryColor: "#D32F2F", accentColor: null, logoUrl: null, heroImageUrl: null, darkHero: false },
      hero: { title: "Muévete por Bogotá", subtitle: null, ctaPrimary: null, ctaSecondary: null },
      apps: { ios: null, android: null, web: null },
      highlights: [],
      screenshots: [],
      stats: { show: false, items: [] },
      partners: [],
      openData: { show: false, links: [] },
      faq: [],
      contact: { email: null, url: null, social: { x: null, instagram: null, github: null } },
      footer: { legalName: null, privacyUrl: null, termsUrl: null, attribution: null },
    },
  } as unknown as AdminEditable;

  const eff = <K extends keyof AdminEditable>(override: AdminOverride, section: K) => effectiveSection(override, yamlFull, section);
  const errorsFor = <K extends keyof AdminEditable>(override: AdminOverride, section: K) => validateSection(section, eff(override, section), EN_MESSAGES);

  it("Asistente: `apiKey: null` means «keep the YAML key», not «there is no key»", () => {
    // The override that blocked the operator: the tab refused to save because it
    // validated the patch, where the assistant is on and the key is missing.
    const override = { config: { assistant: { enabled: true, apiKey: null } } } as unknown as AdminOverride;
    const config = eff(override, "config") as CityConfig;
    const assistant = config.assistant as AssistantConfig;
    expect(assistant.enabled).toBe(true); // the patch applied
    expect(assistant.apiKey).toBe("••••1a2b"); // inherited, so the city still has a key
    expect(assistant.provider).toBe("deepseek"); // and everything the patch is silent about
    expect(config.vehiclePollSeconds).toBe(15);
    expect(errorsFor(override, "config")).toEqual({});
  });

  it("Configuración: a patch that touches one number keeps the rest of the section", () => {
    const override = { config: { vehiclePollSeconds: 20 } } as unknown as AdminOverride;
    const config = eff(override, "config") as CityConfig;
    expect(config.vehiclePollSeconds).toBe(20);
    expect(config.departuresRefreshSeconds).toBe(30);
    expect(config.minAppVersion?.ios).toBe("1.4.0"); // a semver the patch never mentions
    expect(errorsFor(override, "config")).toEqual({});
  });

  it("Tarifas: a patch with only the base keeps the currency and the window", () => {
    const override = { fares: { base: 3400 } } as unknown as AdminOverride;
    const fares = eff(override, "fares") as CityFares;
    expect(fares.base).toBe(3400);
    expect(fares.currency).toBe("COP");
    expect(fares.transferWindowMinutes).toBe(110);
    expect(errorsFor(override, "fares")).toEqual({});
  });

  it("Movilidad: a patch that adds a tariff keeps the bike networks", () => {
    const override = {
      mobility: {
        taxiTariffs: [{ id: "taxi", name: "Taxi", currency: "COP", flagFall: 3500, unitMeters: 100, unitPrice: 120, unitSeconds: 0, minimumFare: 5000 }],
      },
    } as unknown as AdminOverride;
    const mobility = eff(override, "mobility") as CityMobility;
    expect(mobility.taxiTariffs?.length).toBe(1);
    expect(mobility.bikeShare?.[0]?.id).toBe("tembici"); // not wiped by a patch about taxis
    expect(errorsFor(override, "mobility")).toEqual({});
  });

  it("Página: a patch that changes the hero keeps the rest of the landing", () => {
    const override = { landing: { hero: { title: "Bogotá se mueve" } } } as unknown as AdminOverride;
    const landing = eff(override, "landing") as CityLanding;
    expect(landing.hero.title).toBe("Bogotá se mueve");
    expect(landing.slug).toBe("bogota"); // a slug the patch never mentions
    expect(landing.theme.primaryColor).toBe("#D32F2F");
    expect(errorsFor(override, "landing")).toEqual({});
  });

  it("Enlaces: a patch about one link does not drop the others", () => {
    const override = { links: { pqrs: "https://nuevo.example" } } as unknown as AdminOverride;
    const links = eff(override, "links") as CityLinks;
    expect(links.pqrs).toBe("https://nuevo.example");
    expect(links.recharge).toBe("https://recarga.example");
  });

  it("lists replace and null deletes, exactly as the server merges", () => {
    // A list is a value, not a thing to merge: the server replaces it wholesale.
    const replaced = eff({ services: [] } as unknown as AdminOverride, "services");
    expect(replaced).toEqual([]);
    // null inherits: the admin endpoint writes null for a secret it masked away,
    // so reading it as "delete this field" would break the very case this fixes
    const cleared = eff({ fares: { note: null } } as unknown as AdminOverride, "fares") as CityFares;
    expect(cleared.note).toBe(bogota.note);
    // and a section the override does not mention comes straight from the YAML
    expect(eff({} as AdminOverride, "branding")).toEqual({ primaryColor: "#D32F2F" });
  });
});
