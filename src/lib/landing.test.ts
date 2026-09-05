import { describe, expect, it } from "vitest";
import { ctaHref, inkOn, normalizeLanding, resolveTheme, rotateHue, visibleStats } from "./landing";
import { EN_MESSAGES, validateLanding } from "./admin/validate";
import type { CityLanding } from "./api/types";

const city = { branding: { primaryColor: "#D32F2F", logoUrl: null }, components: [{ color: "#D32F2F" }, { color: "#2E7D4F" }] };

describe("normalizeLanding", () => {
  it("fills every nullable section from an empty or partial config", () => {
    const l = normalizeLanding(null);
    expect(l.enabled).toBe(true);
    expect(l.stats.items).toHaveLength(5);
    expect(l.contact.social.github).toBeNull();
    const p = normalizeLanding({ hero: { title: "Hola" } as CityLanding["hero"], faq: [{ q: "a", a: "b" }] });
    expect(p.hero.title).toBe("Hola");
    expect(p.hero.ctaPrimary).toBeNull();
    expect(p.faq).toHaveLength(1);
    expect(p.theme.darkHero).toBe(true);
  });
});

describe("theme resolution", () => {
  it("uses config colours, else branding, and derives an accent from the second component", () => {
    const base = normalizeLanding(null);
    const th = resolveTheme(base, city);
    expect(th.primary).toBe("#D32F2F");
    expect(th.accent).toBe("#2E7D4F");
    expect(th.primaryInk).toBe("#ffffff");
    const custom = resolveTheme(normalizeLanding({ theme: { primaryColor: "#FFFFFF", accentColor: "#000000", logoUrl: null, heroImageUrl: null, darkHero: false } }), city);
    expect(custom.primary).toBe("#FFFFFF");
    expect(custom.primaryInk).toBe("#1a1d21");
    expect(custom.accent).toBe("#000000");
    expect(custom.darkHero).toBe(false);
  });
  it("falls back to a hue shift when there is no second colour", () => {
    const th = resolveTheme(normalizeLanding(null), { branding: { primaryColor: "#0B5CD5" }, components: [] });
    expect(th.accent).not.toBe("#0B5CD5");
    expect(th.accent).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("contrast helper picks dark ink on light backgrounds", () => {
    expect(inkOn("#FFFFFF")).toBe("#1a1d21");
    expect(inkOn("#000000")).toBe("#ffffff");
    expect(rotateHue("#ff0000", 120)).toBe("#00ff00");
  });
});

describe("stats and CTAs", () => {
  it("shows only configured, numeric, positive stats in config order", () => {
    const l = normalizeLanding({ stats: { show: true, items: ["vehiclesLive", "routes", "bikeStations"] } });
    const s = visibleStats(l, { routes: 1024, vehiclesLive: 0, bikeStations: null, generatedAt: "2026-09-04T12:00:00Z" });
    expect(s).toEqual([{ key: "routes", value: 1024 }]);
    expect(visibleStats(normalizeLanding({ stats: { show: false, items: ["routes"] } }), { routes: 5, generatedAt: "" })).toEqual([]);
  });
  it("primary CTA falls back to the app route", () => {
    expect(ctaHref(null, "/bogota")).toBe("/bogota");
    expect(ctaHref({ url: " " }, "/bogota")).toBe("/bogota");
    expect(ctaHref({ url: "https://x.gov.co" }, "/bogota")).toBe("https://x.gov.co");
  });
});

describe("validateLanding", () => {
  it("accepts the defaults", () => {
    expect(validateLanding(normalizeLanding(null), EN_MESSAGES)).toEqual({});
  });
  it("flags urls, lengths, list caps, icons and stat keys", () => {
    const bad = normalizeLanding({
      locale: "fr" as "es",
      theme: { primaryColor: "red", accentColor: null, logoUrl: "http://x", heroImageUrl: null, darkHero: true },
      hero: { title: "x".repeat(81), subtitle: null, ctaPrimary: { label: "", url: "ftp://x" }, ctaSecondary: null },
      apps: { ios: "http://apple.com", android: null, web: null },
      highlights: Array.from({ length: 9 }, () => ({ icon: "nope" as "route", title: "", text: "" })),
      screenshots: [{ url: "x", alt: "", kind: "tablet" as "web" }],
      stats: { show: true, items: ["bogus" as "routes"] },
      faq: [{ q: "", a: "" }],
      contact: { email: "not-an-email", url: null, social: { x: null, instagram: null, github: null } },
    });
    const e = validateLanding(bad, EN_MESSAGES);
    for (const k of [
      "landing.locale",
      "landing.theme.primaryColor",
      "landing.theme.logoUrl",
      "landing.hero.title",
      "landing.hero.ctaPrimary.label",
      "landing.hero.ctaPrimary.url",
      "landing.apps.ios",
      "landing.highlights",
      "landing.highlights.0.icon",
      "landing.highlights.0.title",
      "landing.screenshots.0.url",
      "landing.screenshots.0.alt",
      "landing.screenshots.0.kind",
      "landing.stats.items.0",
      "landing.faq.0.q",
      "landing.faq.0.a",
      "landing.contact.email",
    ])
      expect(e, k).toHaveProperty(k);
  });
  it("allows anchors and paths for CTA links", () => {
    const l = normalizeLanding({ hero: { title: null, subtitle: null, ctaPrimary: { label: "Abrir", url: "/bogota" }, ctaSecondary: { label: "Cómo", url: "#features" } } });
    expect(validateLanding(l, EN_MESSAGES)).toEqual({});
  });
});
