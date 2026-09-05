import type { City, Mode } from "./api/types";
import { COMPONENT_COLORS } from "./colors";
import { TRANSIT_MODES } from "./planner-params";
import type { PlannerState } from "./planner-params";
import { bikeShareEnabled, bikeShareNetworks } from "./rental";
import { onDemandEnabled, onDemandProviders } from "./ondemand";

/**
 * The planner's mode grid (aligned with the mobile app): compact toggles, icon over a
 * short label, filled with the mode / component / provider colour when on. Pure so the
 * order and the gating (shared bikes, taxi/app) are unit-tested.
 */
export type ToggleKind = "mode" | "rental" | "taxi";
export type PlannerToggle = { key: string; kind: ToggleKind; mode?: Mode; label: string; color: string; ink: string; on: boolean; hint: string | null };

export type ToggleLabels = { mode: (m: Mode) => string; bike: string; walk: string; rental: string; taxi: string; rentalHint: (names: string) => string; taxiHint: (names: string) => string };

/** Mode colours: transit modes take the city's component colour, walking/cycling neutral tones. */
export function modeColor(city: City, m: Mode): string {
  const byComp = (c: keyof typeof COMPONENT_COLORS) => city.components?.find((x) => x.id === c)?.color ?? COMPONENT_COLORS[c];
  switch (m) {
    case "BUS":
      return byComp("trunk");
    case "CABLE_CAR":
      return byComp("cable");
    case "RAIL":
    case "SUBWAY":
    case "TRAM":
      return byComp("rail");
    case "BICYCLE":
      return "#2e7d4f";
    case "WALK":
      return "#1a1d21";
    default:
      return "#667085";
  }
}

export function plannerToggles(city: City, state: Pick<PlannerState, "modes" | "rental" | "taxi">, labels: ToggleLabels, opts: { rental?: boolean; taxi?: boolean } = {}): PlannerToggle[] {
  const out: PlannerToggle[] = [];
  const modes: Mode[] = [...TRANSIT_MODES.filter((m) => city.modes.includes(m)), ...(city.modes.includes("BICYCLE") ? (["BICYCLE"] as Mode[]) : []), "WALK"];
  for (const m of modes) {
    out.push({ key: m, kind: "mode", mode: m, label: m === "BICYCLE" ? labels.bike : m === "WALK" ? labels.walk : labels.mode(m), color: modeColor(city, m), ink: "#ffffff", on: state.modes.includes(m), hint: null });
  }
  if (opts.rental !== false && bikeShareEnabled(city)) {
    const nets = bikeShareNetworks(city);
    out.push({ key: "rental", kind: "rental", label: labels.rental, color: nets[0]?.color ?? "#00A859", ink: "#ffffff", on: state.rental, hint: labels.rentalHint(nets.map((n) => n.name).join(" · ")) });
  }
  if (opts.taxi !== false && onDemandEnabled(city)) {
    const ps = onDemandProviders(city);
    out.push({ key: "taxi", kind: "taxi", label: labels.taxi, color: ps[0]?.color ?? "#F2C200", ink: ps[0]?.textColor ?? "#111111", on: state.taxi, hint: labels.taxiHint(ps.map((p) => p.name).join(" · ")) });
  }
  return out;
}

/** Six per row on phones; a second row only when the city has more than six modes. */
export const TOGGLES_PER_ROW = 6;
export function toggleRows(n: number): number {
  return Math.max(1, Math.ceil(n / TOGGLES_PER_ROW));
}
