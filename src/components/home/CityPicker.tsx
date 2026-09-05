"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useCities } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n/provider";
import { Wordmark } from "@/components/shell/CityHeader";
import { Spinner } from "@/components/ui/primitives";
import { MOCK } from "@/lib/api/client";

const LAST_CITY = "opentransit.city";

export function CityPicker() {
  const { t, lang, setLang } = useI18n();
  const { data, isLoading, error } = useCities();
  const router = useRouter();
  const cities = useMemo(() => data?.cities ?? [], [data]);

  useEffect(() => {
    if (cities.length === 1) router.replace(`/${cities[0].id}`);
  }, [cities, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-5 py-8">
      <div className="flex items-center justify-between">
        <Wordmark className="text-lg" />
        <button
          type="button"
          onClick={() => setLang(lang === "es" ? "en" : "es")}
          className="rounded-lg px-2 py-1 text-xs font-bold text-ink-2 hover:bg-paper-3"
        >
          {lang === "es" ? "EN" : "ES"}
        </button>
      </div>

      <section className="mt-14 md:mt-24">
        <h1 className="max-w-[18ch] text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">{t.tagline}</h1>
        <p className="mt-4 max-w-prose text-base text-ink-2 md:text-lg">{t.chooseCityHint}</p>
      </section>

      <section className="mt-10" aria-labelledby="cities">
        <h2 id="cities" className="text-sm font-semibold text-ink-2">
          {t.chooseCity}
        </h2>
        {isLoading ? (
          <div className="mt-4">
            <Spinner />
          </div>
        ) : null}
        {error ? <p className="mt-4 text-sm text-brick">{t.common.error}</p> : null}
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {cities.map((c) => (
            <li key={c.id}>
              <Link
                href={`/${c.id}`}
                onClick={() => {
                  try {
                    localStorage.setItem(LAST_CITY, c.id);
                  } catch {
                    /* ignore */
                  }
                }}
                className="group flex items-center gap-4 rounded-card border border-line bg-paper-2 p-4 shadow-card transition-colors hover:border-ink"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-extrabold text-white" style={{ background: c.branding.primaryColor }}>
                  {c.name.slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-bold">{c.name}</span>
                  <span className="block truncate text-xs text-ink-3">
                    {c.agencies.length} {lang === "es" ? "operadores" : "agencies"} · {c.features.realtimeVehicles ? (lang === "es" ? "tiempo real" : "realtime") : lang === "es" ? "horarios" : "timetable"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-16 text-xs text-ink-3">
        <Link href="/about" className="font-semibold text-ink-2 hover:underline">
          {t.nav.about}
        </Link>
        <a href="https://github.com/jeronimotech" className="font-semibold text-ink-2 hover:underline" rel="noreferrer" target="_blank">
          GitHub
        </a>
        <span>{t.openSource} · MIT</span>
        {MOCK ? <span className="rounded bg-amber px-1.5 py-0.5 font-bold text-amber-ink">{t.common.mock}</span> : null}
      </footer>
    </main>
  );
}
