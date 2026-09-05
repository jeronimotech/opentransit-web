"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { fmtDistance, fmtDuration, fmtMoney } from "@/lib/format";
import { formatPriceRange, handoffPlatform, legLeadPrice, providerById, providerFallback, tariffById, withPlatform, type HandoffPlatform } from "@/lib/ondemand";
import { API_URL } from "@/lib/api/client";
import { Badge, Icon } from "@/components/ui/primitives";
import type { City, Leg, LegOnDemandProvider } from "@/lib/api/types";

/** Relative API hand-off paths become absolute against the configured API host. */
function absolute(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${API_URL}${url}` : url;
}

/**
 * A taxi / ride-hailing leg inside the itinerary timeline: the ride line, a provider
 * picker (colour, name, price or "Precio en la app", "Pedir"), the tariff source and
 * the surcharges applied. Every name and colour comes from the leg / the city config.
 */
export function OnDemandLegBlock({ leg, city, open, onToggle }: { leg: Leg; city: City; open: boolean; onToggle: () => void }) {
  const { t, lang } = useI18n();
  const od = leg.onDemand!;
  const [platform, setPlatform] = useState<HandoffPlatform>("web");
  useEffect(() => setPlatform(handoffPlatform(navigator.userAgent)), []);
  const lead = legLeadPrice(leg);
  const leadProvider = lead?.provider ?? od.providers[0] ?? null;
  const tariffProvider = od.providers.find((p) => p.source === "tariff");
  const tariff = tariffById(city, providerById(city, tariffProvider?.providerId)?.estimate.tariffId);
  const surcharges = new Set(od.providers.flatMap((p) => p.price?.surchargesApplied ?? []));
  const surchargeLabel = (id: string) => {
    const s = tariff?.surcharges.find((x) => x.id === id);
    return s?.label ?? (t.ondemand.surcharges as Record<string, string>)[id] ?? id;
  };

  return (
    <div className="mt-1.5 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-sm font-extrabold" style={{ background: leadProvider?.color ?? "#667085", color: leadProvider?.textColor ?? "#ffffff" }}>
          <Icon.Car width={14} height={14} /> {od.kind === "taxi" ? t.ondemand.taxi : t.ondemand.ridehail}
        </span>
        <button type="button" onClick={onToggle} className="inline-flex items-center gap-1 text-xs font-semibold text-signal" aria-expanded={open}>
          <Icon.Chevron width={14} height={14} className={`transition-transform ${open ? "rotate-90" : ""}`} />
          {t.ondemand.ride} · {fmtDuration(leg.durationSeconds, lang)} · {fmtDistance(leg.distanceMeters, lang)}
        </button>
        {lead ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-paper-3 px-1.5 py-0.5 text-xs font-semibold text-ink">
            <Icon.Fare width={12} height={12} />
            {formatPriceRange(lead.price, lang)}
          </span>
        ) : null}
      </div>

      {open ? (
        <p className="text-xs text-ink-2">
          {leg.from.name} → {leg.to.name}
        </p>
      ) : null}

      {/* provider picker */}
      <div className="rounded-xl border border-line bg-paper" role="group" aria-label={t.ondemand.pickProvider}>
        <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t.ondemand.providers}</p>
        <ul className="divide-y divide-line">
          {od.providers.map((p) => (
            <ProviderRow key={p.providerId} p={p} city={city} platform={platform} recommended={p.providerId === od.recommendedProviderId} />
          ))}
        </ul>
      </div>

      {surcharges.size ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {[...surcharges].map((id) => (
            <Badge key={id} tone="warn">
              {surchargeLabel(id)}
            </Badge>
          ))}
        </div>
      ) : null}
      {tariff ? (
        <p className="text-[11px] text-ink-3">
          {t.ondemand.tariffSource(tariff.source?.label ?? tariff.name)}
          {tariff.source?.url ? (
            <>
              {" "}
              <a href={tariff.source.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2">
                <Icon.External width={10} height={10} className="inline" />
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function ProviderRow({ p, city, platform, recommended }: { p: LegOnDemandProvider; city: City; platform: HandoffPlatform; recommended: boolean }) {
  const { t, lang } = useI18n();
  const cfg = providerById(city, p.providerId);
  const price = formatPriceRange(p.price, lang);
  const href = absolute(withPlatform(p.handoffUrl, platform)) ?? providerFallback(cfg, platform);
  const textColor = p.textColor ?? cfg?.textColor ?? "#ffffff";
  return (
    <li className="flex min-h-12 items-center gap-3 px-3 py-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold" style={{ background: p.color, color: textColor }} aria-hidden>
        {cfg?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cfg.logoUrl} alt="" className="h-5 w-5 object-contain" />
        ) : (
          p.name.slice(0, 2).toUpperCase()
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-bold">
          <span className="truncate">{p.name}</span>
          {recommended ? <Badge tone="ok">{t.ondemand.recommended}</Badge> : null}
        </span>
        <span className="block text-xs text-ink-2">
          {price ? (
            <span className="tabular-nums">{price}</span>
          ) : (
            <span className="text-ink-3">{t.ondemand.priceInApp}</span>
          )}
          {p.waitSeconds != null ? ` · ${t.ondemand.wait(Math.max(1, Math.round(p.waitSeconds / 60)))}` : ""}
          {p.price?.amount != null && p.price.breakdown?.length ? (
            <span className="sr-only">
              {p.price.breakdown.map((b) => `${b.label} ${fmtMoney(b.amount, p.price!.currency, lang)}`).join(", ")}
            </span>
          ) : null}
        </span>
      </span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer noopener" className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-bold" style={{ background: p.color, color: textColor }} aria-label={t.ondemand.requestWith(p.name)}>
          {t.ondemand.request} <Icon.External width={12} height={12} />
        </a>
      ) : (
        <span className="text-xs text-ink-3">{t.ondemand.priceInApp}</span>
      )}
    </li>
  );
}
