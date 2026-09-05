import type { Metadata } from "next";
import Link from "next/link";
import { ApiRequestError, api } from "@/lib/api/client";
import type { LandingResponse } from "@/lib/api/types";
import { copyFor } from "@/lib/landing-copy";
import { landingJsonLd, normalizeLanding, siteUrl } from "@/lib/landing";
import { LandingView } from "./LandingView";
import { LandingPreview } from "./LandingPreview";

/** Fetch the landing with ISR-style caching; null when disabled or unknown city. */
export async function loadLanding(city: string): Promise<{ data: LandingResponse | null; status: "ok" | "disabled" | "missing" | "error" }> {
  try {
    const data = await api.landing(city, { next: { revalidate: 300 } } as RequestInit);
    return { data, status: "ok" };
  } catch (err) {
    if (err instanceof ApiRequestError) {
      if (err.code === "LANDING_DISABLED") return { data: null, status: "disabled" };
      if (err.status === 404) return { data: null, status: "missing" };
    }
    return { data: null, status: "error" };
  }
}

const isPreview = (sp?: Record<string, string | string[] | undefined>) => sp?.preview === "1" || sp?.preview === "true";

export async function landingMetadata(city: string, path: string, sp?: Record<string, string | string[] | undefined>): Promise<Metadata> {
  const { data } = await loadLanding(city);
  if (!data) return { title: city, robots: { index: false } };
  const l = normalizeLanding(data.landing);
  const title = l.seo.title ?? l.hero.title ?? data.city.name;
  const description = l.seo.description ?? l.hero.subtitle ?? undefined;
  const base = siteUrl();
  const url = base ? `${base}${path}` : undefined;
  const image = l.seo.ogImageUrl ?? l.screenshots.find((s) => s.kind === "web")?.url ?? l.screenshots[0]?.url;
  return {
    title: { absolute: title },
    description,
    alternates: url ? { canonical: url } : undefined,
    robots: isPreview(sp) ? { index: false } : undefined,
    openGraph: { title, description, url, siteName: data.city.name, locale: l.locale === "es" ? "es_CO" : "en_US", type: "website", images: image ? [{ url: image }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

/**
 * Server half of the landing: loads data, renders the client view (or the preview shell),
 * and injects JSON-LD. Used by `/{city}/landing` and by `/` in single-city deployments.
 */
export async function LandingRoute({ city, path, searchParams }: { city: string; path: string; searchParams?: Record<string, string | string[] | undefined> }) {
  const { data, status } = await loadLanding(city);
  const appHref = `/${encodeURIComponent(city)}`;
  if (!data) return <Disabled appHref={appHref} status={status} />;
  const base = siteUrl();
  const jsonLd = landingJsonLd(data, base ? `${base}${path}` : path, base ? `${base}${appHref}` : appHref);
  if (isPreview(searchParams)) return <LandingPreview initial={data} appHref={appHref} city={city} />;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingView data={data} appHref={appHref} />
    </>
  );
}

function Disabled({ appHref, status }: { appHref: string; status: "disabled" | "missing" | "error" | "ok" }) {
  const t = copyFor("es");
  return (
    <main className="lp mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
      <h1 className="lp-h2">{status === "disabled" ? t.disabledTitle : status === "missing" ? "404" : "503"}</h1>
      <p className="mt-3 text-ink-2">{status === "disabled" ? t.disabledHint : status === "missing" ? "—" : "API"}</p>
      <Link href={status === "missing" ? "/" : appHref} className="lp-btn lp-btn-primary mt-6 w-fit" style={{ ["--lp-primary" as string]: "#1a1d21", ["--lp-primary-ink" as string]: "#fff" }}>
        {t.openApp}
      </Link>
    </main>
  );
}
