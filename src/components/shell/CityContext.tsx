"use client";

import { createContext, useContext } from "react";
import type { City } from "@/lib/api/types";

export const CityCtx = createContext<City | null>(null);

export function CityProvider({ city, children }: { city: City; children: React.ReactNode }) {
  return <CityCtx.Provider value={city}>{children}</CityCtx.Provider>;
}

export function useCityCtx(): City {
  const c = useContext(CityCtx);
  if (!c) throw new Error("useCityCtx must be used inside CityProvider");
  return c;
}
