import type { Mode, PlanParams } from "./api/types";
import { buildPlanModes } from "./rental";

/**
 * The URL is the source of truth for the planner. This module converts
 * between search params and a typed state, so any plan is shareable.
 *
 * ?from=4.7546,-74.0459&fromName=Portal%20Norte&to=4.5978,-74.1616&toName=Portal%20Sur
 * &time=2026-09-04T08:15:00-05:00&arriveBy=1&modes=BUS,CABLE_CAR&wheelchair=1&rental=1&taxi=1&it=0
 */
export type PlannerPoint = { lat: number; lon: number; name: string | null };

export type PlannerState = {
  from: PlannerPoint | null;
  to: PlannerPoint | null;
  time: string | null; // ISO with offset; null = now
  arriveBy: boolean;
  modes: Mode[]; // transit modes enabled (WALK always implied)
  wheelchair: boolean;
  bike: boolean; // "llegar en bici a la estación" (BICYCLE + TRANSIT)
  rental: boolean; // "Bici pública" (BIKE_RENTAL via GBFS), with or without transit
  taxi: boolean; // "Taxi / app" (on-demand: direct + first/last mile), API flag onDemand=true
  selected: number | null; // itinerary index
};

export const DEFAULT_MODES: Mode[] = ["BUS", "CABLE_CAR", "RAIL", "SUBWAY", "TRAM", "WALK"];
export const TRANSIT_MODES: Mode[] = ["BUS", "CABLE_CAR", "RAIL", "SUBWAY", "TRAM", "FERRY"];

/** Access on foot is implied unless the person chose bike-only. */
export function normalizeModes(modes: Mode[]): Mode[] {
  const out = [...new Set(modes)];
  if (!out.includes("WALK") && !out.includes("BICYCLE")) out.push("WALK");
  return out;
}

function parsePoint(v: string | null, name: string | null): PlannerPoint | null {
  if (!v) return null;
  const [a, b] = v.split(",").map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { lat: a, lon: b, name };
}

export function readPlanner(sp: URLSearchParams): PlannerState {
  const modesRaw = sp.get("modes");
  const modes = normalizeModes(modesRaw ? (modesRaw.split(",").filter(Boolean) as Mode[]) : DEFAULT_MODES);
  const it = sp.get("it");
  return {
    from: parsePoint(sp.get("from"), sp.get("fromName")),
    to: parsePoint(sp.get("to"), sp.get("toName")),
    time: sp.get("time"),
    arriveBy: sp.get("arriveBy") === "1",
    modes,
    wheelchair: sp.get("wheelchair") === "1",
    bike: sp.get("bike") === "1",
    rental: sp.get("rental") === "1",
    taxi: sp.get("taxi") === "1",
    selected: it !== null && it !== "" ? Number(it) : null,
  };
}

const fix = (n: number) => n.toFixed(5);

export function writePlanner(s: PlannerState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.from) {
    p.set("from", `${fix(s.from.lat)},${fix(s.from.lon)}`);
    if (s.from.name) p.set("fromName", s.from.name);
  }
  if (s.to) {
    p.set("to", `${fix(s.to.lat)},${fix(s.to.lon)}`);
    if (s.to.name) p.set("toName", s.to.name);
  }
  if (s.time) p.set("time", s.time);
  if (s.arriveBy) p.set("arriveBy", "1");
  const sortedDefault = [...DEFAULT_MODES].sort().join(",");
  const sorted = [...s.modes].sort().join(",");
  if (sorted !== sortedDefault) p.set("modes", s.modes.join(","));
  if (s.wheelchair) p.set("wheelchair", "1");
  if (s.bike) p.set("bike", "1");
  if (s.rental) p.set("rental", "1");
  if (s.taxi) p.set("taxi", "1");
  if (s.selected !== null) p.set("it", String(s.selected));
  return p;
}

export function toPlanParams(s: PlannerState, locale: "es" | "en", rentalModes: Mode[] = ["BIKE_RENTAL"]): PlanParams | null {
  if (!s.from || !s.to) return null;
  return {
    fromLat: s.from.lat,
    fromLon: s.from.lon,
    toLat: s.to.lat,
    toLon: s.to.lon,
    time: s.time ?? undefined,
    arriveBy: s.arriveBy || undefined,
    modes: buildPlanModes(s.modes, { bike: s.bike, rental: s.rental, rentalModes }),
    wheelchair: s.wheelchair || undefined,
    numItineraries: 6,
    locale,
    fromName: s.from.name ?? undefined,
    toName: s.to.name ?? undefined,
    onDemand: s.taxi || undefined,
  };
}
