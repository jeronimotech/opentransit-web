"use client";

import Link from "next/link";

import { useCityCtx } from "@/components/shell/CityContext";
import { STYLE_LIGHT } from "@/components/map/MapView";
import { useI18n } from "@/lib/i18n/provider";
import { privacyFacts } from "@/lib/privacy";
import { useScreenView } from "@/lib/analytics";

/**
 * The app's own privacy policy, which both app stores require and which the transit
 * agency's policy cannot stand in for: it says nothing about our analytics, our
 * assistant or our location handling.
 *
 * Every claim is derived from the city's live config, so a deployment that turns
 * analytics off or runs another assistant provider reads correctly without anyone
 * remembering to edit this page.
 */
export default function PrivacyPage() {
  const city = useCityCtx();
  const { t } = useI18n();
  useScreenView(city.id, "privacy");
  const f = privacyFacts(city, STYLE_LIGHT);
  const p = t.privacyPage;
  const support = city.links?.support ?? null;
  const agencyPolicy = city.links?.privacy ?? null;

  const Section = ({ h, children }: { h: string; children: React.ReactNode }) => (
    <section className="mt-8">
      <h2 className="text-lg font-bold tracking-tight">{h}</h2>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-24 md:pt-28">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{p.title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{p.intro(city.name)}</p>

      <Section h={p.noAccount.h}>
        <p>{p.noAccount.p}</p>
      </Section>

      <Section h={p.location.h}>
        <p>{p.location.p}</p>
      </Section>

      <Section h={p.analytics.h}>
        {f.analyticsEnabled ? (
          <>
            <p>{p.analytics.on(f.retentionDays ?? 90, f.kThreshold ?? 5)}</p>
            <p>{p.analytics.optOut}</p>
          </>
        ) : (
          <p>{p.analytics.off}</p>
        )}
      </Section>

      <Section h={p.assistant.h}>
        <p>
          {f.assistantEnabled && f.assistantProvider
            ? p.assistant.on(f.assistantProvider)
            : p.assistant.off}
        </p>
      </Section>

      <Section h={p.share.h}>
        <p>{p.share.p}</p>
      </Section>

      <Section h={p.third.h}>
        <p>{p.third.p}</p>
        {f.tileHost ? <p>{p.third.tiles(f.tileHost)}</p> : null}
      </Section>

      <Section h={p.rights.h}>
        <p>{p.rights.p}</p>
      </Section>

      <Section h={p.source.h}>
        <p>
          {p.source.p}{" "}
          <a
            className="font-semibold text-signal hover:underline"
            href="https://github.com/jeronimotech"
            target="_blank"
            rel="noreferrer"
          >
            github.com/jeronimotech
          </a>
        </p>
      </Section>

      <div className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
        {support ? (
          <a className="font-semibold text-signal hover:underline" href={support} target="_blank" rel="noreferrer">
            {p.contact}
          </a>
        ) : null}
        {agencyPolicy ? (
          <a className="font-semibold text-signal hover:underline" href={agencyPolicy} target="_blank" rel="noreferrer">
            {p.agencyPolicy}
          </a>
        ) : null}
        <Link className="font-semibold text-signal hover:underline" href={`/${city.id}`}>
          {city.name}
        </Link>
      </div>
    </main>
  );
}
