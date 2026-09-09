import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CityPicker } from "@/components/home/CityPicker";
import { api } from "@/lib/api/client";
import { cityFromHost, defaultCity, rootLandingCity } from "@/lib/landing";
import { LandingRoute, landingMetadata } from "@/components/landing/LandingRoute";
import type { Metadata } from "next";

export const revalidate = 300;

/**
 * `/`: the city picker, unless this deployment is single-city.
 *  - a host whose first label names a city → that city's landing, whatever the build's default is
 *  - NEXT_PUBLIC_DEFAULT_CITY + NEXT_PUBLIC_ROOT_LANDING=1 → the city's public landing page here, app at /{city}
 *  - NEXT_PUBLIC_DEFAULT_CITY alone → straight into the app
 *
 * The host comes first because one service answers every city subdomain while the
 * default is baked in at build time: toronto.opentransit.tech used to serve Bogotá.
 */
async function landingCityForRequest(): Promise<string | null> {
  const host = (await headers()).get("host");
  try {
    const { cities } = await api.cities();
    const fromHost = cityFromHost(host, cities.map((c) => c.id));
    if (fromHost) return fromHost;
  } catch {
    // The API being down must not turn the root into a 500; fall back to the build's default.
  }
  return rootLandingCity();
}

export async function generateMetadata(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> },
): Promise<Metadata> {
  const city = await landingCityForRequest();
  if (!city) return {};
  return landingMetadata(city, "/", await searchParams);
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const landingCity = await landingCityForRequest();
  if (landingCity) return <LandingRoute city={landingCity} path="/" searchParams={await searchParams} />;
  const city = defaultCity();
  if (city) redirect(`/${city}`);
  return <CityPicker />;
}
