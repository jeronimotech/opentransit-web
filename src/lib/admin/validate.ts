import type { AdminEditable, BikeShareNetwork, CityConfig, CityFares, CityLanding, CityLinks, CityMobility, CityService, OnDemandProvider, TaxiTariff } from "../api/types";
import { validateTemplate } from "../ondemand";
import { LANDING_ICONS, LANDING_STAT_KEYS } from "../api/types";

/** Errors keyed by JSON path ("fares.base"), matching the API's `details[].path`. */
export type Errors = Record<string, string>;

export const RULES = {
  transferWindow: [0, 600],
  maxTransfers: [0, 5],
  pollSeconds: [5, 120],
  refreshSeconds: [5, 120],
} as const;

const isInt = (n: unknown) => typeof n === "number" && Number.isInteger(n);
const isNum = (n: unknown) => typeof n === "number" && Number.isFinite(n);
const inRange = (n: number, [lo, hi]: readonly [number, number]) => n >= lo && n <= hi;
const SEMVER = /^\d+\.\d+\.\d+$/;
const HEX = /^#[0-9a-f]{6}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export function isHttpsUrl(v: unknown): boolean {
  if (typeof v !== "string") return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateFares(f: CityFares | null | undefined, msg: Messages): Errors {
  const e: Errors = {};
  if (!f) return e;
  if (!/^[A-Z]{3}$/.test(f.currency ?? "")) e["fares.currency"] = msg.currency;
  if (!isNum(f.base) || f.base < 0) e["fares.base"] = msg.nonNegative;
  if (!isNum(f.transfer) || f.transfer < 0) e["fares.transfer"] = msg.nonNegative;
  if (!isInt(f.transferWindowMinutes) || !inRange(f.transferWindowMinutes, RULES.transferWindow))
    e["fares.transferWindowMinutes"] = msg.intRange(RULES.transferWindow[0], RULES.transferWindow[1]);
  if (!isInt(f.maxTransfers) || !inRange(f.maxTransfers, RULES.maxTransfers))
    e["fares.maxTransfers"] = msg.intRange(RULES.maxTransfers[0], RULES.maxTransfers[1]);
  if (f.note != null && typeof f.note !== "string") e["fares.note"] = msg.text;
  return e;
}

export function validateConfig(c: CityConfig | null | undefined, msg: Messages): Errors {
  const e: Errors = {};
  if (!c) return e;
  if (!isInt(c.vehiclePollSeconds) || !inRange(c.vehiclePollSeconds, RULES.pollSeconds))
    e["config.vehiclePollSeconds"] = msg.intRange(RULES.pollSeconds[0], RULES.pollSeconds[1]);
  if (!isInt(c.departuresRefreshSeconds) || !inRange(c.departuresRefreshSeconds, RULES.refreshSeconds))
    e["config.departuresRefreshSeconds"] = msg.intRange(RULES.refreshSeconds[0], RULES.refreshSeconds[1]);
  if (c.minAppVersion) {
    if (!SEMVER.test(c.minAppVersion.ios ?? "")) e["config.minAppVersion.ios"] = msg.semver;
    if (!SEMVER.test(c.minAppVersion.android ?? "")) e["config.minAppVersion.android"] = msg.semver;
  }
  if (c.maintenance?.active && !(c.maintenance.message ?? "").trim()) e["config.maintenance.message"] = msg.maintenanceMessage;
  return e;
}

export function validateLinks(l: CityLinks | null | undefined, msg: Messages): Errors {
  const e: Errors = {};
  if (!l) return e;
  for (const k of ["pqrs", "recharge", "support", "privacy", "fares"] as const) {
    const v = l[k];
    if (v != null && v !== "" && !isHttpsUrl(v)) e[`links.${k}`] = msg.https;
  }
  return e;
}

export function validateServices(s: CityService[] | null | undefined, msg: Messages): Errors {
  const e: Errors = {};
  if (!s) return e;
  const seen = new Set<string>();
  s.forEach((row, i) => {
    if (!SLUG.test(row.id ?? "")) e[`services.${i}.id`] = msg.slug;
    else if (seen.has(row.id)) e[`services.${i}.id`] = msg.duplicateId;
    seen.add(row.id);
    if (!(row.label ?? "").trim()) e[`services.${i}.label`] = msg.required;
    if (!(row.icon ?? "").trim()) e[`services.${i}.icon`] = msg.required;
    if (!isHttpsUrl(row.url)) e[`services.${i}.url`] = msg.https;
    if (row.kind !== "external" && row.kind !== "internal") e[`services.${i}.kind`] = msg.kind;
  });
  return e;
}

/** Bike-share networks: N per city; ids unique; gbfs.json over https; at least one vehicle type. */
export function validateMobility(m: CityMobility | null | undefined, msg: Messages): Errors {
  const e: Errors = {};
  if (!m) return e;
  const seen = new Set<string>();
  (m.bikeShare ?? []).forEach((n: BikeShareNetwork, i: number) => {
    const k = `mobility.bikeShare.${i}`;
    if (!SLUG.test(n.id ?? "")) e[`${k}.id`] = msg.slug;
    else if (seen.has(n.id)) e[`${k}.id`] = msg.duplicateId;
    seen.add(n.id);
    if (!(n.name ?? "").trim()) e[`${k}.name`] = msg.required;
    if (!(n.network ?? "").trim()) e[`${k}.network`] = msg.required;
    if (!isHttpsUrl(n.gbfsUrl) || !/\.json(\?.*)?$/i.test(n.gbfsUrl)) e[`${k}.gbfsUrl`] = msg.gbfs;
    if (!HEX.test(n.color ?? "")) e[`${k}.color`] = msg.hex;
    if (n.url != null && n.url !== "" && !isHttpsUrl(n.url)) e[`${k}.url`] = msg.https;
    for (const key of ["ios", "android"] as const) {
      const v = n.apps?.[key];
      if (v != null && v !== "" && !isHttpsUrl(v)) e[`${k}.apps.${key}`] = msg.https;
    }
    if (!n.formFactors?.length) e[`${k}.formFactors`] = msg.formFactors;
  });
  validateTaxiTariffs(m.taxiTariffs ?? [], msg, e);
  validateOnDemand(m.onDemand ?? [], m.taxiTariffs ?? [], msg, e);
  const pol = m.onDemandPolicy;
  if (pol) {
    if (!isNum(pol.maxDirectDistanceKm) || pol.maxDirectDistanceKm <= 0) e["mobility.onDemandPolicy.maxDirectDistanceKm"] = msg.positive;
    if (!isNum(pol.maxFeederKm) || pol.maxFeederKm <= 0) e["mobility.onDemandPolicy.maxFeederKm"] = msg.positive;
    for (const f of ["durationFactor", "nightDurationFactor"] as const) {
      const v = pol[f];
      if (v != null && (!isNum(v) || v < 1 || v > 3)) e[`mobility.onDemandPolicy.${f}`] = msg.factorRange;
    }
  }
  return e;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Taxi tariffs (v1.4): taximeter parameters, all non-negative, unit meters > 0, surcharges with a label and a rule. */
export function validateTaxiTariffs(list: TaxiTariff[], msg: Messages, e: Errors = {}): Errors {
  const seen = new Set<string>();
  list.forEach((t, i) => {
    const k = `mobility.taxiTariffs.${i}`;
    if (!SLUG.test(t.id ?? "")) e[`${k}.id`] = msg.slug;
    else if (seen.has(t.id)) e[`${k}.id`] = msg.duplicateId;
    seen.add(t.id);
    if (!(t.name ?? "").trim()) e[`${k}.name`] = msg.required;
    if (!/^[A-Z]{3}$/.test(t.currency ?? "")) e[`${k}.currency`] = msg.currency;
    for (const f of ["flagFall", "unitPrice", "unitSeconds", "minimumFare"] as const) if (!isNum(t[f]) || t[f] < 0) e[`${k}.${f}`] = msg.nonNegative;
    if (!isNum(t.unitMeters) || t.unitMeters <= 0) e[`${k}.unitMeters`] = msg.positive;
    const sids = new Set<string>();
    (t.surcharges ?? []).forEach((sc, j) => {
      const kk = `${k}.surcharges.${j}`;
      if (!SLUG.test(sc.id ?? "")) e[`${kk}.id`] = msg.slug;
      else if (sids.has(sc.id)) e[`${kk}.id`] = msg.duplicateId;
      sids.add(sc.id);
      if (!(sc.label ?? "").trim()) e[`${kk}.label`] = msg.required;
      if (!isNum(sc.amount) || sc.amount < 0) e[`${kk}.amount`] = msg.nonNegative;
      const w = sc.when ?? {};
      if ((w.nightFrom && !HHMM.test(w.nightFrom)) || (w.nightTo && !HHMM.test(w.nightTo))) e[`${kk}.when.nightFrom`] = msg.hhmm;
      if ((w.nightFrom && !w.nightTo) || (!w.nightFrom && w.nightTo)) e[`${kk}.when.nightFrom`] = msg.hhmm;
    });
    if (t.source?.url != null && t.source.url !== "" && !isHttpsUrl(t.source.url)) e[`${k}.source.url`] = msg.https;
  });
  return e;
}

/** On-demand providers (v1.4): kinds from the documented sets, hex colours, https links, templates with placeholders, unique ids and order. */
export function validateOnDemand(list: OnDemandProvider[], tariffs: TaxiTariff[], msg: Messages, e: Errors = {}): Errors {
  const seen = new Set<string>();
  const orders = new Set<number>();
  const tariffIds = new Set(tariffs.map((t) => t.id));
  list.forEach((p, i) => {
    const k = `mobility.onDemand.${i}`;
    if (!SLUG.test(p.id ?? "")) e[`${k}.id`] = msg.slug;
    else if (seen.has(p.id)) e[`${k}.id`] = msg.duplicateId;
    seen.add(p.id);
    if (!(p.name ?? "").trim()) e[`${k}.name`] = msg.required;
    if (p.kind !== "taxi" && p.kind !== "ridehail") e[`${k}.kind`] = msg.onDemandKind;
    if (!HEX.test(p.color ?? "")) e[`${k}.color`] = msg.hex;
    if (p.textColor != null && p.textColor !== "" && !HEX.test(p.textColor)) e[`${k}.textColor`] = msg.hex;
    if (p.logoUrl != null && p.logoUrl !== "" && !isHttpsUrl(p.logoUrl)) e[`${k}.logoUrl`] = msg.https;
    const ek = p.estimate?.kind;
    if (ek !== "tariff" && ek !== "api" && ek !== "none") e[`${k}.estimate.kind`] = msg.estimateKind;
    if (ek === "tariff" && !(p.estimate?.tariffId && tariffIds.has(p.estimate.tariffId))) e[`${k}.estimate.tariffId`] = msg.tariffRef;
    const hk = p.handoff?.kind;
    if (hk !== "none" && hk !== "url" && hk !== "template") e[`${k}.handoff.kind`] = msg.handoffKind;
    if (hk === "template" && !validateTemplate(p.handoff?.template).ok) e[`${k}.handoff.template`] = msg.template;
    if (p.handoff?.web != null && p.handoff.web !== "" && !isHttpsUrl(p.handoff.web)) e[`${k}.handoff.web`] = msg.https;
    for (const key of ["ios", "android"] as const) {
      const v = p.handoff?.apps?.[key];
      if (v != null && v !== "" && !isHttpsUrl(v)) e[`${k}.handoff.apps.${key}`] = msg.https;
    }
    if (!isInt(p.order)) e[`${k}.order`] = msg.intRange(0, 99);
    else if (orders.has(p.order)) e[`${k}.order`] = msg.duplicateOrder;
    orders.add(p.order);
  });
  return e;
}


export const LANDING_LIMITS = { highlights: 8, screenshots: 8, faq: 12, partners: 12, openDataLinks: 12, title: 80, subtitle: 200, highlightTitle: 60, highlightText: 160, faqQ: 120, faqA: 600, cta: 40, seoTitle: 70, seoDescription: 160 } as const;

const optUrl = (e: Errors, path: string, v: unknown, msg: Messages) => {
  if (v != null && v !== "" && !isHttpsUrl(v)) e[path] = msg.https;
};
const optHex = (e: Errors, path: string, v: unknown, msg: Messages) => {
  if (v != null && v !== "" && !HEX.test(String(v))) e[path] = msg.hex;
};
const maxLen = (e: Errors, path: string, v: unknown, n: number, msg: Messages) => {
  if (v != null && typeof v === "string" && v.trim().length > n) e[path] = msg.maxLen(n);
};

/** Landing page content: bounded lists and text, https urls, icons/stat keys from the documented sets. */
export function validateLanding(l: CityLanding | null | undefined, msg: Messages): Errors {
  const e: Errors = {};
  if (!l) return e;
  const p = "landing";
  if (l.locale !== "es" && l.locale !== "en") e[`${p}.locale`] = msg.locale;
  optHex(e, `${p}.theme.primaryColor`, l.theme?.primaryColor, msg);
  optHex(e, `${p}.theme.accentColor`, l.theme?.accentColor, msg);
  optUrl(e, `${p}.theme.logoUrl`, l.theme?.logoUrl, msg);
  optUrl(e, `${p}.theme.heroImageUrl`, l.theme?.heroImageUrl, msg);
  maxLen(e, `${p}.hero.title`, l.hero?.title, LANDING_LIMITS.title, msg);
  maxLen(e, `${p}.hero.subtitle`, l.hero?.subtitle, LANDING_LIMITS.subtitle, msg);
  for (const k of ["ctaPrimary", "ctaSecondary"] as const) {
    const c = l.hero?.[k];
    if (!c) continue;
    if (!(c.label ?? "").trim()) e[`${p}.hero.${k}.label`] = msg.required;
    maxLen(e, `${p}.hero.${k}.label`, c.label, LANDING_LIMITS.cta, msg);
    if (c.url != null && c.url !== "" && !c.url.startsWith("#") && !c.url.startsWith("/") && !isHttpsUrl(c.url)) e[`${p}.hero.${k}.url`] = msg.httpsOrAnchor;
  }
  for (const k of ["ios", "android", "web"] as const) optUrl(e, `${p}.apps.${k}`, l.apps?.[k], msg);
  if ((l.highlights ?? []).length > LANDING_LIMITS.highlights) e[`${p}.highlights`] = msg.maxItems(LANDING_LIMITS.highlights);
  (l.highlights ?? []).forEach((h, i) => {
    if (!LANDING_ICONS.includes(h.icon)) e[`${p}.highlights.${i}.icon`] = msg.icon;
    if (!(h.title ?? "").trim()) e[`${p}.highlights.${i}.title`] = msg.required;
    maxLen(e, `${p}.highlights.${i}.title`, h.title, LANDING_LIMITS.highlightTitle, msg);
    maxLen(e, `${p}.highlights.${i}.text`, h.text, LANDING_LIMITS.highlightText, msg);
  });
  if ((l.screenshots ?? []).length > LANDING_LIMITS.screenshots) e[`${p}.screenshots`] = msg.maxItems(LANDING_LIMITS.screenshots);
  (l.screenshots ?? []).forEach((s, i) => {
    if (!isHttpsUrl(s.url)) e[`${p}.screenshots.${i}.url`] = msg.https;
    if (!(s.alt ?? "").trim()) e[`${p}.screenshots.${i}.alt`] = msg.required;
    if (s.kind !== "mobile" && s.kind !== "web") e[`${p}.screenshots.${i}.kind`] = msg.kind;
  });
  (l.stats?.items ?? []).forEach((k, i) => {
    if (!LANDING_STAT_KEYS.includes(k)) e[`${p}.stats.items.${i}`] = msg.statKey;
  });
  if ((l.partners ?? []).length > LANDING_LIMITS.partners) e[`${p}.partners`] = msg.maxItems(LANDING_LIMITS.partners);
  (l.partners ?? []).forEach((x, i) => {
    if (!(x.name ?? "").trim()) e[`${p}.partners.${i}.name`] = msg.required;
    optUrl(e, `${p}.partners.${i}.logoUrl`, x.logoUrl, msg);
    optUrl(e, `${p}.partners.${i}.url`, x.url, msg);
  });
  if ((l.openData?.links ?? []).length > LANDING_LIMITS.openDataLinks) e[`${p}.openData.links`] = msg.maxItems(LANDING_LIMITS.openDataLinks);
  (l.openData?.links ?? []).forEach((x, i) => {
    if (!(x.label ?? "").trim()) e[`${p}.openData.links.${i}.label`] = msg.required;
    if (!isHttpsUrl(x.url)) e[`${p}.openData.links.${i}.url`] = msg.https;
  });
  if ((l.faq ?? []).length > LANDING_LIMITS.faq) e[`${p}.faq`] = msg.maxItems(LANDING_LIMITS.faq);
  (l.faq ?? []).forEach((x, i) => {
    if (!(x.q ?? "").trim()) e[`${p}.faq.${i}.q`] = msg.required;
    maxLen(e, `${p}.faq.${i}.q`, x.q, LANDING_LIMITS.faqQ, msg);
    if (!(x.a ?? "").trim()) e[`${p}.faq.${i}.a`] = msg.required;
    maxLen(e, `${p}.faq.${i}.a`, x.a, LANDING_LIMITS.faqA, msg);
  });
  if (l.contact?.email != null && l.contact.email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.contact.email)) e[`${p}.contact.email`] = msg.email;
  optUrl(e, `${p}.contact.url`, l.contact?.url, msg);
  for (const k of ["x", "instagram", "github"] as const) optUrl(e, `${p}.contact.social.${k}`, l.contact?.social?.[k], msg);
  optUrl(e, `${p}.footer.privacyUrl`, l.footer?.privacyUrl, msg);
  optUrl(e, `${p}.footer.termsUrl`, l.footer?.termsUrl, msg);
  maxLen(e, `${p}.seo.title`, l.seo?.title, LANDING_LIMITS.seoTitle, msg);
  maxLen(e, `${p}.seo.description`, l.seo?.description, LANDING_LIMITS.seoDescription, msg);
  optUrl(e, `${p}.seo.ogImageUrl`, l.seo?.ogImageUrl, msg);
  return e;
}

export function validateBranding(b: { primaryColor: string } | null | undefined, msg: Messages): Errors {
  const e: Errors = {};
  if (!b) return e;
  if (!HEX.test(b.primaryColor ?? "")) e["branding.primaryColor"] = msg.hex;
  return e;
}

export function validateSection<K extends keyof AdminEditable>(section: K, value: AdminEditable[K], msg: Messages): Errors {
  switch (section) {
    case "fares":
      return validateFares(value as CityFares | null, msg);
    case "config":
      return validateConfig(value as CityConfig | null, msg);
    case "links":
      return validateLinks(value as CityLinks | null, msg);
    case "services":
      return validateServices(value as CityService[] | null, msg);
    case "branding":
      return validateBranding(value as { primaryColor: string } | null, msg);
    case "mobility":
      return validateMobility(value as CityMobility | null, msg);
    case "landing":
      return validateLanding(value as CityLanding | null, msg);
    default:
      return {};
  }
}

export type Messages = {
  currency: string;
  nonNegative: string;
  intRange: (lo: number, hi: number) => string;
  text: string;
  semver: string;
  maintenanceMessage: string;
  https: string;
  slug: string;
  duplicateId: string;
  required: string;
  kind: string;
  hex: string;
  gbfs: string;
  formFactors: string;
  maxLen: (n: number) => string;
  maxItems: (n: number) => string;
  locale: string;
  icon: string;
  statKey: string;
  email: string;
  httpsOrAnchor: string;
  positive: string;
  onDemandKind: string;
  estimateKind: string;
  tariffRef: string;
  handoffKind: string;
  template: string;
  hhmm: string;
  duplicateOrder: string;
  factorRange: string;
};

/** English messages, used by the mock API and tests; the UI passes translated ones. */
export const EN_MESSAGES: Messages = {
  currency: "3-letter ISO code, e.g. COP",
  nonNegative: "must be a number ≥ 0",
  intRange: (lo, hi) => `must be an integer between ${lo} and ${hi}`,
  text: "must be text",
  semver: "must look like 1.2.3",
  maintenanceMessage: "a message is required while maintenance is active",
  https: "must be an https:// URL (or empty)",
  slug: "lowercase letters, digits and dashes",
  duplicateId: "id already used",
  required: "required",
  kind: "must be external or internal",
  hex: "must be a hex colour like #D32F2F",
  gbfs: "must be an https URL to a gbfs.json",
  formFactors: "pick at least one vehicle type",
  maxLen: (n) => `at most ${n} characters`,
  maxItems: (n) => `at most ${n} items`,
  locale: "must be es or en",
  icon: "unknown icon",
  statKey: "unknown stat",
  email: "must be an email address",
  httpsOrAnchor: "must be an https:// URL, a /path or a #anchor",
  positive: "must be a number > 0",
  onDemandKind: "must be taxi or ridehail",
  estimateKind: "must be tariff, api or none",
  tariffRef: "must reference an existing tariff",
  handoffKind: "must be none, url or template",
  template: "must be an https template with at least one known placeholder",
  hhmm: "must be a time like 19:00",
  duplicateOrder: "order already used",
  factorRange: "must be between 1.0 and 3.0",
};

const normPath = (p: string) => p.replace(/\[(\d+)\]/g, ".$1").replace(/^\$\.?/, "");
const PATHISH = /^[a-z][\w.[\]]*$/;

/**
 * Turn API `details[]` into the same shape as local validation errors. When the API
 * sends only a message ("fares.currency: String should match…; fares.base: …"), split it
 * into field errors so they still land next to the right input.
 */
export function errorsFromDetails(details: { path: string; message: string }[] | undefined, message?: string): Errors {
  const e: Errors = {};
  for (const d of details ?? []) e[normPath(d.path)] = d.message;
  if (!Object.keys(e).length && message) {
    for (const part of message.split(/;\s+|\n/)) {
      const m = part.match(/^([^:]+):\s*(.+)$/);
      if (m && PATHISH.test(m[1].trim())) e[normPath(m[1].trim())] = m[2].trim();
    }
  }
  return e;
}
