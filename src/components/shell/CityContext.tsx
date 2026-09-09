"use client";

import { createContext, useContext, useEffect } from "react";
import type { City } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/provider";

export const CityCtx = createContext<City | null>(null);

export function CityProvider({ city, children }: { city: City; children: React.ReactNode }) {
  const { applyCityLocale } = useI18n();
  // Start in the city's own language. Spanish everywhere was right while Bogotá was
  // the only city and wrong the moment Toronto existed. A choice the person made
  // still wins — `applyCityLocale` refuses when there is one.
  useEffect(() => {
    applyCityLocale(city.locale);
  }, [city.locale, applyCityLocale]);
  return <CityCtx.Provider value={city}>{children}</CityCtx.Provider>;
}

export function useCityCtx(): City {
  const c = useContext(CityCtx);
  if (!c) throw new Error("useCityCtx must be used inside CityProvider");
  return c;
}
