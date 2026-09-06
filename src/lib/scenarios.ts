import type { CityFares, Itinerary } from "./api/types";
import { estimateFare } from "./fare";

/**
 * Results grouped by scenario (Citymapper): each itinerary lands in exactly ONE section,
 * assigned by best fit in this priority — on-demand and bike are "what you asked for",
 * then the three transit angles. Sections render in SCENARIO_ORDER.
 */
export type Scenario = "fastest" | "lessWalking" | "fewestTransfers" | "cheapest" | "bike" | "ondemand";
export const SCENARIO_ORDER: Scenario[] = ["fastest", "lessWalking", "fewestTransfers", "cheapest", "bike", "ondemand"];

export type ScenarioGroup = { scenario: Scenario; best: Itinerary; rest: Itinerary[] };

const isOnDemand = (it: Itinerary) => it.legs.some((l) => l.onDemand) || it.source === "ondemand";
const isBike = (it: Itinerary) => it.legs.some((l) => l.mode === "BICYCLE" || l.rental);

function fareOf(it: Itinerary, fares?: CityFares | null): number | null {
  const f = estimateFare(it, fares);
  return f && Number.isFinite(f.amount) ? f.amount : null;
}

/**
 * Assign each itinerary to one scenario. Transit-only itineraries compete for
 * fastest / lessWalking / fewestTransfers / cheapest: the champion of each metric
 * takes that section (ties → earlier index), everyone else joins the section where
 * they rank best relative to the champion.
 */
export function groupByScenario(list: Itinerary[], fares?: CityFares | null): ScenarioGroup[] {
  if (!list.length) return [];
  const buckets = new Map<Scenario, Itinerary[]>();
  const put = (s: Scenario, it: Itinerary) => buckets.set(s, [...(buckets.get(s) ?? []), it]);

  const transit: Itinerary[] = [];
  for (const it of list) {
    if (isOnDemand(it)) put("ondemand", it);
    else if (isBike(it)) put("bike", it);
    else transit.push(it);
  }

  if (transit.length) {
    const fareVals = transit.map((it) => fareOf(it, fares));
    const faresDiffer = new Set(fareVals.filter((v) => v !== null)).size > 1;
    const ranked = (metric: (it: Itinerary, i: number) => number) =>
      transit.map((it, i) => i).sort((a, b) => metric(transit[a], a) - metric(transit[b], b) || a - b);
    // champion priority (not the render order): price is a strong differentiator, so it
    // claims its lead right after "fastest" whenever the fares actually differ
    const metrics: { s: Scenario; m: (it: Itinerary, i: number) => number }[] = [
      { s: "fastest", m: (it) => it.durationSeconds },
      ...(faresDiffer ? [{ s: "cheapest" as Scenario, m: (_: Itinerary, i: number) => fareVals[i] ?? Number.MAX_SAFE_INTEGER }] : []),
      { s: "lessWalking", m: (it) => it.walkDistanceMeters },
      { s: "fewestTransfers", m: (it) => it.transfers * 1e6 + it.durationSeconds },
    ];
    const assigned = new Map<number, Scenario>();
    const champions = new Map<Scenario, number>();
    // champions first, in priority order: the best still-unassigned itinerary for each angle,
    // so "fastest" is never stolen by "fewest transfers" and every section has a distinct lead
    for (const { s, m } of metrics) {
      const c = ranked(m).find((i) => !assigned.has(i));
      if (c === undefined) continue;
      assigned.set(c, s);
      champions.set(s, c);
    }
    // the rest: closest to which champion? (normalised distance per metric)
    for (let i = 0; i < transit.length; i++) {
      if (assigned.has(i)) continue;
      let bestS: Scenario = "fastest";
      let bestD = Infinity;
      for (const { s, m } of metrics) {
        const c = champions.get(s);
        if (c === undefined) continue;
        const base = Math.max(1, m(transit[c], c));
        const d = (m(transit[i], i) - base) / base;
        if (d < bestD) {
          bestD = d;
          bestS = s;
        }
      }
      assigned.set(i, bestS);
    }
    for (let i = 0; i < transit.length; i++) put(assigned.get(i)!, transit[i]);
  }

  const out: ScenarioGroup[] = [];
  for (const s of SCENARIO_ORDER) {
    const items = buckets.get(s);
    if (!items?.length) continue;
    const sorted = [...items].sort((a, b) => scenarioRank(s, a, fares) - scenarioRank(s, b, fares));
    out.push({ scenario: s, best: sorted[0], rest: sorted.slice(1) });
  }
  return out;
}

function scenarioRank(s: Scenario, it: Itinerary, fares?: CityFares | null): number {
  switch (s) {
    case "fastest":
    case "bike":
    case "ondemand":
      return it.durationSeconds;
    case "lessWalking":
      return it.walkDistanceMeters;
    case "fewestTransfers":
      return it.transfers * 1e6 + it.durationSeconds;
    case "cheapest":
      return (fareOf(it, fares) ?? Number.MAX_SAFE_INTEGER) * 1e6 + it.durationSeconds;
  }
}
