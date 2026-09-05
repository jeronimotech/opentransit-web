"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { fmtDistance, fmtDuration } from "@/lib/format";
import { formatPriceRange, handoffHref, handoffPlatform, legLeadPrice, pricedProviders, providerById, providerFallback, requestLabel, tariffById, type HandoffPlatform } from "@/lib/ondemand";
import { API_URL } from "@/lib/api/client";
import { Icon } from "@/components/ui/primitives";
import type { City, Leg, LegOnDemandProvider } from "@/lib/api/types";

/** Relative API hand-off paths become absolute against the configured API host. */
function absolute(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${API_URL}${url}` : url;
}

/**
 * A taxi / ride-hailing leg inside the itinerary timeline, compact like the mobile app:
 * one-line header, ONE primary "Pedir" button for the recommended provider, a row of pills
 * for the others, a "Ver precios" disclosure when several have estimates, and a muted
 * tariff footnote. Every name and colour comes from the leg / the city config.
 */
export function OnDemandLegBlock({ leg, city, open, onToggle }: { leg: Leg; city: City; open: boolean; onToggle: () => void }) {
  const { t, lang } = useI18n();
  const od = leg.onDemand!;
  const [platform, setPlatform] = useState<HandoffPlatform>("web");
  const [prices, setPrices] = useState(false);
  useEffect(() => setPlatform(handoffPlatform(navigator.userAgent)), []);
  const names = { fromName: leg.from.name, toName: leg.to.name };
  const href = (p: LegOnDemandProvider) => absolute(handoffHref(p.handoffUrl, platform, names)) ?? providerFallback(providerById(city, p.providerId), platform);
  const ink = (p: LegOnDemandProvider) => p.textColor ?? providerById(city, p.providerId)?.textColor ?? "#ffffff";

  const lead = legLeadPrice(leg);
  const primary = lead?.provider ?? od.providers.find((p) => p.providerId === od.recommendedProviderId) ?? od.providers[0] ?? null;
  const others = od.providers.filter((p) => p.providerId !== primary?.providerId);
  const priced = pricedProviders(leg);
  const kindLabel = od.kind === "taxi" ? t.ondemand.taxi : od.kind === "ridehail" ? t.ondemand.ridehail : t.ondemand.title;

  const tariffProvider = od.providers.find((p) => p.source === "tariff");
  const tariff = tariffById(city, providerById(city, tariffProvider?.providerId)?.estimate.tariffId);
  const surcharges = [...new Set(od.providers.flatMap((p) => p.price?.surchargesApplied ?? []))];
  const surchargeLabel = (id: string) => tariff?.surcharges.find((x) => x.id === id)?.label ?? (t.ondemand.surcharges as Record<string, string>)[id] ?? id;

  return (
    <div className="mt-1.5 flex flex-col gap-2">
      {/* header: "Taxi · 10 min · 4,9 km", then the destination */}
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-6 items-center gap-1.5 text-left text-sm">
        <span className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-extrabold" style={{ background: primary?.color ?? "#667085", color: primary ? ink(primary) : "#ffffff" }}>
          <Icon.Car width={13} height={13} /> {kindLabel}
        </span>
        <span className="font-semibold text-ink-2">
          {fmtDuration(leg.durationSeconds, lang)} · {fmtDistance(leg.distanceMeters, lang)}
        </span>
        <Icon.Chevron width={14} height={14} className={`text-ink-3 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      <p className="-mt-1 truncate text-xs text-ink-2">
        {t.planner.rideTo} <span className="font-semibold text-ink">{leg.to.name}</span>
      </p>

      {/* one primary action for the recommended provider */}
      {primary ? (
        <a
          href={href(primary) ?? undefined}
          target="_blank"
          rel="noreferrer noopener"
          data-testid="ondemand-primary"
          aria-label={t.ondemand.requestWith(primary.name)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold shadow-sm"
          style={{ background: primary.color, color: ink(primary) }}
        >
          <Icon.Car width={16} height={16} />
          <span className="truncate">{requestLabel(primary, formatPriceRange(primary.price, lang), { request: t.ondemand.request, requestWith: t.ondemand.requestWith, taxi: t.ondemand.taxi })}</span>
          <Icon.External width={12} height={12} />
        </a>
      ) : null}

      {/* the others as small pills, one scrolling row */}
      {others.length ? (
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]" role="group" aria-label={t.ondemand.orRequestWith}>
          <span className="shrink-0 text-xs text-ink-3">{t.ondemand.orRequestWith}</span>
          {others.map((p) => (
            <a
              key={p.providerId}
              href={href(p) ?? undefined}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={t.ondemand.requestWith(p.name)}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border-2 px-3 text-xs font-bold whitespace-nowrap"
              style={{ borderColor: p.color, color: "inherit" }}
            >
              {p.name}
            </a>
          ))}
        </div>
      ) : null}

      {/* prices, only when it is a comparison */}
      {priced.length >= 2 ? (
        <div>
          <button type="button" onClick={() => setPrices((o) => !o)} aria-expanded={prices} className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-signal">
            <Icon.Chevron width={14} height={14} className={`transition-transform ${prices ? "rotate-90" : ""}`} />
            {prices ? t.ondemand.hidePrices : t.ondemand.seePrices}
          </button>
          {prices ? (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {priced.map((p) => (
                <li key={p.providerId}>
                  <a href={href(p) ?? undefined} target="_blank" rel="noreferrer noopener" aria-label={t.ondemand.requestWith(p.name)} className="flex min-h-10 items-center gap-2 px-2.5 text-sm hover:bg-paper-3">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded text-[9px] font-extrabold" style={{ background: p.color, color: ink(p) }} aria-hidden>
                      {p.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    <span className="shrink-0 tabular-nums text-ink-2">{formatPriceRange(p.price, lang)}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* muted footnote: tariff source + surcharges */}
      {tariff || surcharges.length ? (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-ink-3">
          {tariff ? <span>{t.ondemand.tariffSource(tariff.source?.label ?? tariff.name)}</span> : null}
          {tariff?.source?.url ? (
            <a href={tariff.source.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2" aria-label={tariff.source.label}>
              <Icon.External width={10} height={10} className="inline" />
            </a>
          ) : null}
          {surcharges.map((id) => (
            <span key={id} className="rounded-md bg-amber/30 px-1.5 py-0.5 font-semibold text-amber-ink">
              {surchargeLabel(id)}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
