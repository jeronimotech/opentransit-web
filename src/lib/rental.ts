import type { BikeShareNetwork, City, Mode, RentalStation, RentalStationRef } from "./api/types";

/**
 * Shared bikes (GBFS) — pure helpers shared by the planner, the map layer, the
 * itinerary detail and the hub. Kept free of React so they can be unit-tested.
 */

export function bikeShareNetworks(city: City | null | undefined): BikeShareNetwork[] {
  return city?.mobility?.bikeShare ?? [];
}

/** The feature is on when the city declares at least one network (or the legacy flag). */
export function bikeShareEnabled(city: City | null | undefined): boolean {
  if (!city) return false;
  return bikeShareNetworks(city).length > 0 || city.features?.bikeShare === true;
}

export function networkById(city: City | null | undefined, id: string | null | undefined): BikeShareNetwork | null {
  if (!id) return null;
  return bikeShareNetworks(city).find((n) => n.id === id) ?? null;
}

/** Which rental planner modes the city's networks offer. */
export function rentalModesFor(networks: BikeShareNetwork[]): Mode[] {
  const out: Mode[] = [];
  if (networks.some((n) => n.formFactors.includes("bicycle") || n.formFactors.length === 0)) out.push("BIKE_RENTAL");
  // A bike network that also lists a scooter type (GBFS vehicle_types) is still asked for as
  // BIKE_RENTAL; SCOOTER_RENTAL is sent only for scooter-only networks, since routers without a
  // scooter rental network answer an empty plan for it.
  if (networks.some((n) => n.formFactors.includes("scooter") && !n.formFactors.includes("bicycle"))) out.push("SCOOTER_RENTAL");
  return out;
}

export const RENTAL_MODES: Mode[] = ["BIKE_RENTAL", "SCOOTER_RENTAL"];
export const isRentalMode = (m: Mode) => RENTAL_MODES.includes(m);

/**
 * The `modes` query for `/plan` from the planner state.
 *   · transit modes as chosen; WALK implied unless bike-only;
 *   · `bike` (llegar en bici a la estación) adds the person's own BICYCLE;
 *   · `rental` adds BIKE_RENTAL — with transit it becomes access/egress, alone it is a direct trip.
 */
export function buildPlanModes(chosen: Mode[], opts: { bike?: boolean; rental?: boolean; rentalModes?: Mode[] } = {}): Mode[] {
  const out = new Set<Mode>(chosen);
  if (opts.bike) out.add("BICYCLE");
  if (opts.rental) for (const m of opts.rentalModes ?? ["BIKE_RENTAL"]) out.add(m);
  if (!out.has("WALK") && !out.has("BICYCLE")) out.add("WALK");
  return [...out];
}

export type AvailabilityTone = "none" | "low" | "ok";

export function availabilityTone(n: number | null | undefined): AvailabilityTone {
  if (n == null || n <= 0) return "none";
  return n <= 2 ? "low" : "ok";
}

/** "6 bicis · 13 puestos" / "6 bikes · 13 docks" — one style everywhere. */
export function formatAvailability(vehicles: number | null | undefined, docks: number | null | undefined, lang: "es" | "en" = "es"): string {
  const v = vehicles ?? null;
  const d = docks ?? null;
  const bikes = v === null ? null : lang === "es" ? (v === 1 ? "1 bici" : `${v} bicis`) : v === 1 ? "1 bike" : `${v} bikes`;
  const slots = d === null ? null : lang === "es" ? (d === 1 ? "1 puesto" : `${d} puestos`) : d === 1 ? "1 dock" : `${d} docks`;
  return [bikes, slots].filter(Boolean).join(" · ");
}

/** Seconds since the station last reported, or null when unknown. */
export function stationAgeSeconds(lastReported: string | null | undefined, now = Date.now()): number | null {
  if (!lastReported) return null;
  const t = new Date(lastReported).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((now - t) / 1000));
}

export type Platform = "ios" | "android" | "other";

export function detectPlatform(ua: string | null | undefined): Platform {
  const u = (ua ?? "").toLowerCase();
  if (/iphone|ipad|ipod/.test(u)) return "ios";
  if (/android/.test(u)) return "android";
  return "other";
}

/** Where "Abrir {red}" should go: the store/app link for the platform, else the website. */
export function rentalLink(network: BikeShareNetwork | null | undefined, platform: Platform = "other"): string | null {
  if (!network) return null;
  const apps = network.apps ?? {};
  if (platform === "ios" && apps.ios) return apps.ios;
  if (platform === "android" && apps.android) return apps.android;
  return network.url ?? apps.ios ?? apps.android ?? null;
}

export function refToStation(ref: RentalStationRef, networkId: string): RentalStation {
  return {
    id: ref.stationId,
    networkId,
    name: ref.name,
    lat: ref.lat,
    lon: ref.lon,
    capacity: null,
    vehiclesAvailable: ref.vehiclesAvailable ?? 0,
    ebikesAvailable: 0,
    docksAvailable: ref.docksAvailable ?? 0,
    isInstalled: true,
    isRenting: true,
    isReturning: true,
    lastReported: ref.lastReported,
  };
}

/** GBFS 3.0 names are `[{text, language}]`; the API flattens them, but be tolerant. */
export function stationName(name: unknown, lang: "es" | "en" = "es"): string {
  if (typeof name === "string") return name;
  if (Array.isArray(name)) {
    const pick = name.find((n) => n?.language === lang) ?? name.find((n) => n?.language === "es") ?? name[0];
    return pick?.text ?? "";
  }
  return "";
}
