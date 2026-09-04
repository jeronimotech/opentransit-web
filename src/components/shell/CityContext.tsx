"use client";

import { createContext, useContext } from "react";
import type { City } from "@/lib/api/types";

const Ctx = createContext<City | null>(null);

export function CityProvider({ city, children }: { city: City; children: React.ReactNode }) {
  return <Ctx.Provider value={city}>{children}</Ctx.Provider>;
}

export function useCityCtx(): City {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCityCtx must be used inside CityProvider");
  return c;
}
