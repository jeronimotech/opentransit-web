import type { City, CityLanding, LandingResponse, LandingStatKey, LandingStats } from "./api/types";
import { LANDING_STAT_KEYS } from "./api/types";

/**
 * City landing page helpers: fallbacks for every nullable field, theme resolution,
 * stat formatting and the preview-draft handshake with the admin tab.
 * Nothing here knows any city: all copy comes from the config or from neutral strings.
 */

export const LANDING_DRAFT_KEY = (city: string) => `opentransit.admin.landingDraft.${city}`;

export const EMPTY_LANDING: CityLanding = {
  enabled: true,
  slug: null,
  locale: "es",
  theme: { primaryColor: null, accentColor: null, logoUrl: null, heroImageUrl: null, darkHero: true },
  hero: { title: null, subtitle: null, ctaPrimary: null, ctaSecondary: null },
  apps: { ios: null, android: null, web: null },
  highlights: [],
  screenshots: [],
  stats: { show: true, items: [...LANDING_STAT_KEYS] },
  partners: [],
  openData: { show: true, links: [] },
  faq: [],
  contact: { email: null, url: null, social: { x: null, instagram: null, github: null } },
  footer: { legalName: null, privacyUrl: null, termsUrl: null, attribution: null },
  seo: { title: null, description: null, ogImageUrl: null },
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Fill a partial landing (older API, YAML with missing keys) with the empty defaults. */
export function normalizeLanding(l: Partial<CityLanding> | null | undefined): CityLanding {
  const base = clone(EMPTY_LANDING);
  if (!l) return base;
  return {
    ...base,
    ...l,
    theme: { ...base.theme, ...(l.theme ?? {}) },
    hero: { ...base.hero, ...(l.hero ?? {}) },
    apps: { ...base.apps, ...(l.apps ?? {}) },
    stats: { ...base.stats, ...(l.stats ?? {}) },
    openData: { ...base.openData, ...(l.openData ?? {}) },
    contact: { ...base.contact, ...(l.contact ?? {}), social: { ...base.contact.social, ...(l.contact?.social ?? {}) } },
    footer: { ...base.footer, ...(l.footer ?? {}) },
    seo: { ...base.seo, ...(l.seo ?? {}) },
    highlights: l.highlights ?? [],
    screenshots: l.screenshots ?? [],
    partners: l.partners ?? [],
    faq: l.faq ?? [],
  };
}

const HEX = /^#[0-9a-f]{6}$/i;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("")}`;
}
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** White or near-black text, whichever contrasts more with `bg`. */
export function inkOn(bg: string): string {
  if (!HEX.test(bg)) return "#ffffff";
  return luminance(bg) > 0.4 ? "#1a1d21" : "#ffffff";
}
/** Rotate a hex colour's hue by `deg` (used to derive an accent when the config has none). */
export function rotateHue(hex: string, deg: number): string {
  if (!HEX.test(hex)) return hex;
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r2, g2, b2] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex([(r2 + m) * 255, (g2 + m) * 255, (b2 + m) * 255]);
}

export type LandingTheme = { primary: string; primaryInk: string; accent: string; accentInk: string; darkHero: boolean; logoUrl: string | null; heroImageUrl: string | null };

/** Theme: config → branding → neutral. Accent falls back to the second component colour, else a hue shift. */
export function resolveTheme(landing: CityLanding, city: { branding: { primaryColor: string; logoUrl?: string | null }; components?: { color: string }[] | null }): LandingTheme {
  const primary = (landing.theme.primaryColor && HEX.test(landing.theme.primaryColor) ? landing.theme.primaryColor : city.branding.primaryColor) || "#1a1d21";
  const second = (city.components ?? []).map((c) => c.color).find((c) => HEX.test(c) && c.toLowerCase() !== primary.toLowerCase());
  const accent = (landing.theme.accentColor && HEX.test(landing.theme.accentColor) ? landing.theme.accentColor : second) ?? rotateHue(primary, 150);
  return {
    primary,
    primaryInk: inkOn(primary),
    accent,
    accentInk: inkOn(accent),
    darkHero: landing.theme.darkHero !== false,
    logoUrl: landing.theme.logoUrl ?? city.branding.logoUrl ?? null,
    heroImageUrl: landing.theme.heroImageUrl ?? null,
  };
}

/** Which stats to show, in config order, only those the API resolved to a number. */
export function visibleStats(landing: CityLanding, stats: LandingStats | null | undefined): { key: LandingStatKey; value: number }[] {
  if (!landing.stats.show || !stats) return [];
  return landing.stats.items
    .filter((k) => LANDING_STAT_KEYS.includes(k))
    .map((key) => ({ key, value: stats[key] }))
    .filter((s): s is { key: LandingStatKey; value: number } => typeof s.value === "number" && s.value > 0);
}

export function fmtStat(n: number, locale: "es" | "en"): string {
  return new Intl.NumberFormat(locale === "es" ? "es-CO" : "en-US", { maximumFractionDigits: 0 }).format(n);
}

/** Primary CTA: config url, else the web app for this city. */
export function ctaHref(cta: { url: string | null } | null, fallback: string): string {
  return cta?.url && cta.url.trim() ? cta.url : fallback;
}

/** Absolute site URL for canonical/OG links; empty when unknown so tags stay relative. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

/** Single-city deployments: `/` serves the landing (app at `/{city}`). */
export function rootLandingCity(): string | null {
  const on = ["1", "true", "yes"].includes((process.env.NEXT_PUBLIC_ROOT_LANDING ?? "").trim().toLowerCase());
  const city = (process.env.NEXT_PUBLIC_DEFAULT_CITY ?? "").trim();
  return on && city ? city : null;
}
export function defaultCity(): string | null {
  const city = (process.env.NEXT_PUBLIC_DEFAULT_CITY ?? "").trim();
  return city || null;
}

/** JSON-LD for search engines: the app as a MobileApplication/WebApplication plus the site. */
export function landingJsonLd(data: LandingResponse, url: string, appUrl: string): Record<string, unknown>[] {
  const l = data.landing;
  const name = l.seo.title ?? l.hero.title ?? data.city.name;
  const description = l.seo.description ?? l.hero.subtitle ?? undefined;
  const app: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    description,
    url: appUrl,
    applicationCategory: "TravelApplication",
    operatingSystem: "Web, iOS, Android",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    isAccessibleForFree: true,
    inLanguage: l.locale,
  };
  const installs = [l.apps.ios, l.apps.android].filter(Boolean);
  if (installs.length) app.installUrl = installs;
  if (l.seo.ogImageUrl) app.image = l.seo.ogImageUrl;
  const site: Record<string, unknown> = { "@context": "https://schema.org", "@type": "WebSite", name, url, inLanguage: l.locale };
  if (l.footer.legalName) site.publisher = { "@type": "Organization", name: l.footer.legalName };
  return [app, site];
}

/** The parts of a `City` the landing needs, so the same view works from `/landing` and from the admin preview. */
export function cityForLanding(city: City): LandingResponse["city"] {
  return {
    id: city.id,
    name: city.name,
    country: city.country,
    locale: city.locale,
    branding: city.branding,
    attribution: city.attribution,
    links: city.links ?? null,
    services: city.services ?? null,
    mobility: city.mobility ? { bikeShare: city.mobility.bikeShare.map((n) => ({ id: n.id, name: n.name, color: n.color, url: n.url })) } : null,
  };
}
