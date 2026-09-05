import { redirect } from "next/navigation";
import { CityPicker } from "@/components/home/CityPicker";
import { defaultCity, rootLandingCity } from "@/lib/landing";
import { LandingRoute, landingMetadata } from "@/components/landing/LandingRoute";
import type { Metadata } from "next";

export const revalidate = 300;

/**
 * `/`: the city picker, unless this deployment is single-city.
 *  - NEXT_PUBLIC_DEFAULT_CITY + NEXT_PUBLIC_ROOT_LANDING=1 → the city's public landing page here, app at /{city}
 *  - NEXT_PUBLIC_DEFAULT_CITY alone → straight into the app
 */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const city = rootLandingCity();
  if (!city) return {};
  return landingMetadata(city, "/", await searchParams);
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const landingCity = rootLandingCity();
  if (landingCity) return <LandingRoute city={landingCity} path="/" searchParams={await searchParams} />;
  const city = defaultCity();
  if (city) redirect(`/${city}`);
  return <CityPicker />;
}
