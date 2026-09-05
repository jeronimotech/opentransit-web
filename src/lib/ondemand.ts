import type { City, Itinerary, Leg, LegOnDemandProvider, OnDemandPrice, OnDemandProvider, TaxiTariff, TariffSurcharge } from "./api/types";
import { detectPlatform, type Platform } from "./rental";
import { fmtMoney } from "./format";

/**
 * On-demand mobility (taxi / ride-hailing) — pure helpers shared by the planner, the
 * itinerary detail, the stop page and the admin editors. Provider-agnostic: every name,
 * colour and link comes from `city.mobility.onDemand[]`; nothing here knows a brand.
 */

export function onDemandProviders(city: City | null | undefined): OnDemandProvider[] {
  return sortProviders(city?.mobility?.onDemand ?? []);
}

/** Enabled providers in display order (`order` asc, then name), disabled ones dropped. */
export function sortProviders(list: OnDemandProvider[]): OnDemandProvider[] {
  return [...list].filter((p) => p.enabled !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
}

/** The module is on when the city lists at least one enabled provider and the flag is not explicitly off. */
export function onDemandEnabled(city: City | null | undefined): boolean {
  if (!city) return false;
  if (city.features?.onDemand === false) return false;
  return onDemandProviders(city).length > 0;
}

export function providerById(city: City | null | undefined, id: string | null | undefined): OnDemandProvider | null {
  if (!id) return null;
  return (city?.mobility?.onDemand ?? []).find((p) => p.id === id) ?? null;
}

export function taxiTariffs(city: City | null | undefined): TaxiTariff[] {
  return city?.mobility?.taxiTariffs ?? [];
}

export function tariffById(city: City | null | undefined, id: string | null | undefined): TaxiTariff | null {
  if (!id) return null;
  return taxiTariffs(city).find((t) => t.id === id) ?? null;
}

/* ── prices ─────────────────────────────────────────────────────────────────── */

const money = (n: number, currency: string, lang: "es" | "en") => fmtMoney(n, currency, lang);

/**
 * "≈ $18.000–22.000" when the estimate carries a band, "≈ $18.000" when it is a point,
 * `null` when there is no number at all (the UI then says "Precio en la app").
 */
export function formatPriceRange(price: OnDemandPrice | null | undefined, lang: "es" | "en" = "es"): string | null {
  if (!price) return null;
  const { currency } = price;
  const lo = price.min ?? price.amount;
  const hi = price.max ?? price.amount;
  if (lo == null && hi == null) return null;
  const approx = price.estimated ? "≈ " : "";
  if (lo != null && hi != null && Math.round(lo) !== Math.round(hi)) {
    // share the currency symbol once: "$ 18.000–22.000"
    const a = money(lo, currency, lang);
    const b = money(hi, currency, lang);
    const numB = b.replace(/[^\d.,\s]/g, "").trim();
    return `${approx}${a}–${numB}`;
  }
  return `${approx}${money((lo ?? hi) as number, currency, lang)}`;
}

/** The price to lead with on a leg: the recommended provider's, else the cheapest known. */
export function legLeadPrice(leg: Leg): { provider: LegOnDemandProvider; price: OnDemandPrice } | null {
  const od = leg.onDemand;
  if (!od) return null;
  const rec = od.providers.find((p) => p.providerId === od.recommendedProviderId && p.price?.amount != null);
  if (rec?.price) return { provider: rec, price: rec.price };
  const priced = od.providers.filter((p) => p.price?.amount != null).sort((a, b) => (a.price!.amount as number) - (b.price!.amount as number));
  return priced[0] ? { provider: priced[0], price: priced[0].price! } : null;
}

export function onDemandLegs(it: Itinerary): Leg[] {
  return it.legs.filter((l) => !!l.onDemand);
}

export function isOnDemandItinerary(it: Itinerary): boolean {
  return it.legs.some((l) => !!l.onDemand);
}

/** Direct on-demand trip (one car leg, maybe walks) vs. a "Taxi → Bus" combo. */
export function onDemandShape(it: Itinerary): "direct" | "combo" | null {
  if (!isOnDemandItinerary(it)) return null;
  return it.legs.some((l) => l.transit) ? "combo" : "direct";
}

/** Sum of the lead prices of every on-demand leg (for sorting / summary); null if any leg is unpriced. */
export function itineraryOnDemandTotal(it: Itinerary): { min: number; max: number; currency: string } | null {
  let min = 0,
    max = 0,
    currency: string | null = null;
  for (const l of onDemandLegs(it)) {
    const lead = legLeadPrice(l);
    if (!lead) return null;
    min += lead.price.min ?? (lead.price.amount as number);
    max += lead.price.max ?? (lead.price.amount as number);
    currency = lead.price.currency;
  }
  return currency ? { min, max, currency } : null;
}

/* ── hand-off ───────────────────────────────────────────────────────────────── */

export type HandoffPlatform = "ios" | "android" | "web";

export function handoffPlatform(ua: string | null | undefined): HandoffPlatform {
  const p: Platform = detectPlatform(ua);
  return p === "other" ? "web" : p;
}

/** Append `platform=` to an API hand-off URL unless the server already put one. */
export function withPlatform(url: string | null | undefined, platform: HandoffPlatform): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, "https://localhost");
    if (!u.searchParams.has("platform")) u.searchParams.set("platform", platform);
    // keep relative URLs relative
    return url.startsWith("http") ? u.toString() : `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

/** Where "Pedir" falls back to when the provider has no template: the store for the platform, else the website. */
export function providerFallback(p: Pick<OnDemandProvider, "handoff"> | null | undefined, platform: HandoffPlatform): string | null {
  const h = p?.handoff;
  if (!h) return null;
  const apps = h.apps ?? {};
  if (platform === "ios" && apps.ios) return apps.ios;
  if (platform === "android" && apps.android) return apps.android;
  return h.web ?? apps.ios ?? apps.android ?? null;
}

/* ── templates (admin) ──────────────────────────────────────────────────────── */

export const TEMPLATE_PLACEHOLDERS = ["clientId", "pickupLat", "pickupLon", "pickupName", "dropoffLat", "dropoffLon", "dropoffName", "pickupJson", "dropoffJson"] as const;
export type TemplatePlaceholder = (typeof TEMPLATE_PLACEHOLDERS)[number];

export function templatePlaceholders(template: string | null | undefined): string[] {
  const out: string[] = [];
  for (const m of (template ?? "").matchAll(/\{([a-zA-Z]+)\}/g)) out.push(m[1]);
  return out;
}

/** A template is valid when it is an https URL with at least one known placeholder and no unknown ones. */
export function validateTemplate(template: string | null | undefined): { ok: boolean; unknown: string[]; known: string[] } {
  const found = templatePlaceholders(template);
  const known = found.filter((p) => (TEMPLATE_PLACEHOLDERS as readonly string[]).includes(p));
  const unknown = found.filter((p) => !(TEMPLATE_PLACEHOLDERS as readonly string[]).includes(p));
  const https = /^https:\/\//i.test((template ?? "").trim());
  return { ok: https && known.length > 0 && unknown.length === 0, unknown, known };
}

export type SampleTrip = { pickup: { lat: number; lon: number; name: string }; dropoff: { lat: number; lon: number; name: string }; clientId?: string | null };

/** Client-side preview of a template (the API does the real build with the stored credentials). */
export function renderTemplate(template: string, trip: SampleTrip): string {
  const json = (p: SampleTrip["pickup"]) => JSON.stringify({ latitude: p.lat, longitude: p.lon, addressLine1: p.name });
  const vals: Record<TemplatePlaceholder, string> = {
    clientId: trip.clientId ?? "",
    pickupLat: String(trip.pickup.lat),
    pickupLon: String(trip.pickup.lon),
    pickupName: trip.pickup.name,
    dropoffLat: String(trip.dropoff.lat),
    dropoffLon: String(trip.dropoff.lon),
    dropoffName: trip.dropoff.name,
    pickupJson: json(trip.pickup),
    dropoffJson: json(trip.dropoff),
  };
  return template.replace(/\{([a-zA-Z]+)\}/g, (m, k: string) => (k in vals ? encodeURIComponent(vals[k as TemplatePlaceholder]) : m));
}

/** Masked credential as the API returns it ("••••1a2b"). */
export const isMaskedCredential = (v: string | null | undefined) => !!v && /^[•*]{2,}/.test(v);

/**
 * Providers as they must be PUT: the list replaces, so a row saved WITHOUT `credentials`
 * wipes the stored secret. Echo the masked value exactly as received when unchanged,
 * send the new plain value when changed, and `{ clientId: null }` when explicitly cleared.
 */
export function providersPayload(rows: OnDemandProvider[]): OnDemandProvider[] {
  return rows.map((p) => ({ ...p, credentials: { clientId: p.credentials?.clientId?.trim() ? p.credentials.clientId : null } }));
}

/* ── taxi tariff calculator (admin preview; the API computes the real estimate) ── */

export type TariffContext = {
  /** Local time of day "HH:MM" and weekday (0 = Sunday) in the city's timezone. */
  hhmm: string;
  weekday: number;
  holiday?: boolean;
  /** Tariff zone ids the trip touches (e.g. "airport"). */
  zones?: string[];
  /** Optional surcharges the rider accepts (e.g. "door"). */
  optional?: string[];
};

export function localParts(date: Date, tz: string): { hhmm: string; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hh = get("hour") === "24" ? "00" : get("hour");
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { hhmm: `${hh}:${get("minute")}`, weekday: wd < 0 ? 0 : wd };
}

const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

/** Is `hhmm` inside a window that may wrap midnight ("19:00" → "06:00")? */
export function inNightWindow(hhmm: string, from: string | null | undefined, to: string | null | undefined): boolean {
  if (!from || !to) return false;
  const t = mins(hhmm),
    a = mins(from),
    b = mins(to);
  return a <= b ? t >= a && t < b : t >= a || t < b;
}

export function surchargeApplies(s: TariffSurcharge, ctx: TariffContext): boolean {
  const w = s.when ?? {};
  if (w.optional) return (ctx.optional ?? []).includes(s.id);
  if (w.zones?.length) return w.zones.some((z) => (ctx.zones ?? []).includes(z));
  if (w.sundays && ctx.weekday === 0) return true;
  if (w.holidays && ctx.holiday) return true;
  if (w.nightFrom && w.nightTo) return inNightWindow(ctx.hhmm, w.nightFrom, w.nightTo);
  return false;
}

export type TariffEstimate = { amount: number; min: number; max: number; currency: string; breakdown: { label: string; amount: number }[]; surchargesApplied: string[]; units: number };

/**
 * Same rule the API uses for `estimate.kind = "tariff"`: flag fall + distance units
 * (ceil) × unit price, never below the minimum fare, plus the surcharges that apply;
 * ±10 % traffic band. Waiting-time units are left to the router (distance only here).
 */
export function estimateTaxi(tariff: TaxiTariff, distanceMeters: number, ctx: TariffContext, labels: { flagFall: string; distance: (units: number, meters: number) => string; minimum: string }): TariffEstimate {
  const unitMeters = tariff.unitMeters > 0 ? tariff.unitMeters : 100;
  const units = Math.max(0, Math.ceil(distanceMeters / unitMeters));
  const ride = tariff.flagFall + units * tariff.unitPrice;
  const breakdown: { label: string; amount: number }[] = [
    { label: labels.flagFall, amount: tariff.flagFall },
    { label: labels.distance(units, distanceMeters), amount: units * tariff.unitPrice },
  ];
  let amount = ride;
  if (ride < tariff.minimumFare) {
    breakdown.push({ label: labels.minimum, amount: tariff.minimumFare - ride });
    amount = tariff.minimumFare;
  }
  const surchargesApplied: string[] = [];
  for (const s of tariff.surcharges ?? []) {
    if (!surchargeApplies(s, ctx)) continue;
    surchargesApplied.push(s.id);
    breakdown.push({ label: s.label, amount: s.amount });
    amount += s.amount;
  }
  const round = (n: number) => Math.round(n / 100) * 100;
  return { amount, min: round(amount * 0.9), max: round(amount * 1.1), currency: tariff.currency, breakdown, surchargesApplied, units };
}
