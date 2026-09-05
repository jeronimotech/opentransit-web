import type { AdminEditable, BikeShareNetwork, CityConfig, CityFares, CityLinks, CityMobility, CityService } from "../api/types";

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
