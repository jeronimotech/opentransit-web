import type { Metadata } from "next";
import { LandingRoute, landingMetadata } from "@/components/landing/LandingRoute";

export const revalidate = 300;

type Props = { params: Promise<{ city: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { city } = await params;
  return landingMetadata(decodeURIComponent(city), `/${encodeURIComponent(city)}/landing`, await searchParams);
}

/** The city's public page. Server-rendered from `/v1/cities/{city}/landing`, revalidated every 5 minutes. */
export default async function CityLandingPage({ params, searchParams }: Props) {
  const { city } = await params;
  const c = decodeURIComponent(city);
  return <LandingRoute city={c} path={`/${encodeURIComponent(c)}/landing`} searchParams={await searchParams} />;
}
