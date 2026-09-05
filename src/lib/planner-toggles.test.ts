import { describe, expect, it } from "vitest";
import { modeColor, plannerToggles, toggleRows, TOGGLES_PER_ROW } from "./planner-toggles";
import type { City } from "./api/types";

const labels = { mode: (m: string) => m, bike: "Bici", walk: "A pie", rental: "Pública", taxi: "Taxi/app", rentalHint: (n: string) => `bikes ${n}`, taxiHint: (n: string) => `taxi ${n}` };
const city = {
  modes: ["WALK", "BUS", "CABLE_CAR", "BICYCLE"],
  components: [{ id: "trunk", color: "#D32F2F" }, { id: "cable", color: "#6A1B9A" }],
  features: { bikeShare: true, onDemand: true },
  mobility: {
    bikeShare: [{ id: "net", name: "Red", color: "#00A859", network: "n", gbfsUrl: "https://x/gbfs.json", url: null, apps: null, pricingSummary: null, formFactors: ["bicycle"] }],
    onDemand: [{ id: "taxi", name: "Taxi", kind: "taxi", color: "#F2C200", textColor: "#111111", estimate: { kind: "none" }, handoff: { kind: "none" }, enabled: true, order: 1 }],
  },
} as unknown as City;
const state = { modes: ["BUS", "WALK"] as City["modes"], rental: true, taxi: false };

describe("planner mode toggles", () => {
  it("orders transit modes, then own bike, walk, shared bikes and taxi/app", () => {
    const t = plannerToggles(city, state, labels);
    expect(t.map((x) => x.key)).toEqual(["BUS", "CABLE_CAR", "BICYCLE", "WALK", "rental", "taxi"]);
    expect(t.map((x) => x.on)).toEqual([true, false, false, true, true, false]);
  });
  it("uses the component colour for transit, the network colour for shared bikes and the first provider's for taxi/app", () => {
    const t = plannerToggles(city, state, labels);
    expect(t.find((x) => x.key === "BUS")?.color).toBe("#D32F2F");
    expect(t.find((x) => x.key === "CABLE_CAR")?.color).toBe("#6A1B9A");
    expect(t.find((x) => x.key === "rental")?.color).toBe("#00A859");
    expect(t.find((x) => x.key === "taxi")).toMatchObject({ color: "#F2C200", ink: "#111111", hint: "taxi Taxi" });
    expect(modeColor(city, "WALK")).toBe("#1a1d21");
  });
  it("gates shared bikes and taxi/app by the feature flags and the caller", () => {
    expect(plannerToggles(city, state, labels, { rental: false }).map((x) => x.key)).not.toContain("rental");
    expect(plannerToggles({ ...city, features: { onDemand: false } } as unknown as City, state, labels).map((x) => x.key)).not.toContain("taxi");
    expect(plannerToggles({ ...city, mobility: { bikeShare: [], onDemand: [] }, features: {} } as unknown as City, state, labels).map((x) => x.key)).toEqual(["BUS", "CABLE_CAR", "BICYCLE", "WALK"]);
  });
  it("fits six per row and wraps only beyond six", () => {
    expect(TOGGLES_PER_ROW).toBe(6);
    expect(toggleRows(6)).toBe(1);
    expect(toggleRows(7)).toBe(2);
    expect(plannerToggles(city, state, labels).length).toBe(6);
  });
});
