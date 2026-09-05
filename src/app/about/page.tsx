"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Wordmark } from "@/components/shell/CityHeader";
import { useCities } from "@/lib/api/hooks";

export default function About() {
  const { t } = useI18n();
  const { data } = useCities();
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-5 py-8">
      <div className="flex items-center justify-between">
        <Link href="/">
          <Wordmark className="text-lg" />
        </Link>
      </div>
      <article className="prose-sm mt-12 max-w-prose">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">{t.about.title}</h1>
        <p className="mt-5 text-base text-ink-2">{t.about.p1}</p>
        <p className="mt-3 text-base text-ink-2">{t.about.p2}</p>

        <h2 className="mt-10 text-lg font-bold">{t.about.stack}</h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-2">
          <li>{t.about.web}</li>
          <li>{t.about.api}</li>
          <li>{t.about.mobile}</li>
        </ul>

        <h2 className="mt-10 text-lg font-bold">{t.about.data}</h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-2">
          {(data?.cities ?? []).map((c) => (
            <li key={c.id}>
              <span className="font-semibold text-ink">{c.name}</span> — {c.attribution}{" "}
              <Link href={`/${c.id}/landing`} className="font-semibold text-signal underline-offset-2 hover:underline">
                {t.about.cityPage}
              </Link>
            </li>
          ))}
        </ul>

        <h2 className="mt-10 text-lg font-bold">{t.about.contribute}</h2>
        <p className="mt-2 text-sm text-ink-2">{t.about.contributeHint}</p>
        <ul className="mt-2 flex flex-wrap gap-3 text-sm font-semibold text-signal">
          <li>
            <a href="https://github.com/jeronimotech/opentransit-api" target="_blank" rel="noreferrer">
              opentransit-api
            </a>
          </li>
          <li>
            <a href="https://github.com/jeronimotech/opentransit-web" target="_blank" rel="noreferrer">
              opentransit-web
            </a>
          </li>
          <li>
            <a href="https://github.com/jeronimotech/opentransit-mobile" target="_blank" rel="noreferrer">
              opentransit-mobile
            </a>
          </li>
        </ul>
        <p className="mt-10 text-xs text-ink-3">
          {t.about.version} 0.1.0 · MIT
        </p>
      </article>
    </main>
  );
}
