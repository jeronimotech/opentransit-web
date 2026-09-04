import type { City, CityComponent, CityConfig, CityFares, Component } from "./api/types";
import { COMPONENT_COLORS } from "./colors";

/**
 * v1.1 city config with defaults, so pages never branch on "is this an old API".
 * Everything here is remote-configurable per city (poll intervals, feature flags,
 * maintenance, fare parameters, component taxonomy).
 */

const DEFAULT_FEATURES: Required<CityConfig["features"]> = {
  liveVehicles: true,
  board: true,
  pois: true,
  followAlong: true,
  bike: true,
  next: true,
  favorites: true,
  alerts: true,
};

export type ResolvedConfig = {
  vehiclePollSeconds: number;
  departuresRefreshSeconds: number;
  features: Required<CityConfig["features"]>;
  maintenance: { active: boolean; message: string | null };
};

export function resolveConfig(city: City): ResolvedConfig {
  const c = city.config;
  const features = { ...DEFAULT_FEATURES, ...(c?.features ?? {}) };
  // legacy v1 flags still gate the same modules
  if (!city.features.realtimeVehicles) features.liveVehicles = false;
  if (!city.features.alerts) features.alerts = false;
  return {
    vehiclePollSeconds: clamp(c?.vehiclePollSeconds ?? 15, 5, 120),
    departuresRefreshSeconds: clamp(c?.departuresRefreshSeconds ?? 20, 10, 300),
    features,
    maintenance: c?.maintenance ?? { active: false, message: null },
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const DEFAULT_LABEL: Record<Component, string> = {
  trunk: "Troncal",
  feeder: "Alimentador",
  dual: "Dual",
  zonal: "Zonal",
  cable: "Cable",
  rail: "Tren",
  other: "Otro",
};
const DEFAULT_ICON: Record<Component, CityComponent["icon"]> = {
  trunk: "brt",
  feeder: "bus",
  dual: "bus",
  zonal: "bus",
  cable: "cable",
  rail: "rail",
  other: "bus",
};

/** Component taxonomy: from `city.components` when the API sends it, else derived from agencies. */
export function componentsOf(city: City): CityComponent[] {
  if (city.components?.length) return city.components;
  const seen = new Map<Component, CityComponent>();
  for (const a of city.agencies) {
    if (!seen.has(a.component)) {
      seen.set(a.component, {
        id: a.component,
        label: DEFAULT_LABEL[a.component],
        color: a.color || COMPONENT_COLORS[a.component],
        icon: DEFAULT_ICON[a.component],
      });
    }
  }
  return [...seen.values()];
}

export function componentOf(city: City, id: Component | null | undefined): CityComponent {
  const c = id ? componentsOf(city).find((x) => x.id === id) : undefined;
  return (
    c ?? {
      id: id ?? "other",
      label: DEFAULT_LABEL[id ?? "other"],
      color: COMPONENT_COLORS[id ?? "other"],
      icon: DEFAULT_ICON[id ?? "other"],
    }
  );
}

export function faresOf(city: City): CityFares | null {
  return city.fares ?? null;
}
