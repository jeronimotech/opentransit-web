import { describe, expect, it } from "vitest";
import { componentsInGroup, networkLayerLabel } from "./city-config";
import { NETWORK_GROUPS } from "@/components/map/layers";
import type { City, CityComponent } from "./api/types";

const cityWith = (components: CityComponent[]) => ({ components, agencies: [] } as unknown as City);

const BOGOTA = cityWith([
  { id: "trunk", label: "Troncal", color: "#D32F2F", icon: "brt" },
  { id: "feeder", label: "Alimentador", color: "#2E7D32", icon: "bus" },
  { id: "dual", label: "Dual", color: "#6A1B9A", icon: "bus" },
  { id: "zonal", label: "Zonal (SITP)", color: "#1565C0", icon: "bus" },
  { id: "cable", label: "TransMiCable", color: "#EF6C00", icon: "cable" },
] as CityComponent[]);

const TORONTO = cityWith([
  { id: "rail", label: "Subway", color: "#DA291C", icon: "rail" },
  { id: "tram", label: "Streetcar", color: "#0054A6", icon: "tram" },
  { id: "bus", label: "Bus", color: "#DA291C", icon: "bus" },
] as CityComponent[]);

describe("network layer names", () => {
  it("uses each city's own vocabulary", () => {
    expect(networkLayerLabel(BOGOTA, NETWORK_GROUPS.trunk.components)).toBe("Troncal · TransMiCable");
    expect(networkLayerLabel(BOGOTA, NETWORK_GROUPS.zonal.components)).toBe("Alimentador · Dual · Zonal (SITP)");
    // it used to read "Trunk network / BRT trunk lines and cable" here — words that only exist in Bogotá
    expect(networkLayerLabel(TORONTO, NETWORK_GROUPS.trunk.components)).toBe("Subway · Streetcar");
    expect(networkLayerLabel(TORONTO, NETWORK_GROUPS.zonal.components)).toBe("Bus");
  });

  it("is null when the city has nothing to draw in that group, so the toggle is not offered", () => {
    const busOnly = cityWith([{ id: "bus", label: "Bus", color: "#000", icon: "bus" }] as CityComponent[]);
    expect(networkLayerLabel(busOnly, NETWORK_GROUPS.trunk.components)).toBeNull();
    expect(componentsInGroup(busOnly, NETWORK_GROUPS.zonal.components).map((c) => c.id)).toEqual(["bus"]);
  });

  it("leaves no component out of both groups, or its shapes would be unreachable", () => {
    const all: City["components"] = (["trunk", "feeder", "dual", "zonal", "cable", "rail", "tram", "bus", "other"] as const).map(
      (id) => ({ id, label: id, color: "#000", icon: "bus" }),
    ) as CityComponent[];
    const covered = [
      ...componentsInGroup(cityWith(all!), NETWORK_GROUPS.trunk.components),
      ...componentsInGroup(cityWith(all!), NETWORK_GROUPS.zonal.components),
    ].map((c) => c.id);
    expect(new Set(covered).size).toBe(all!.length);
  });
});
