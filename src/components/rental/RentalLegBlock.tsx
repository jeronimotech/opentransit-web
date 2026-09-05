"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { fmtDistance, fmtDuration, fmtMoney } from "@/lib/format";
import { availabilityTone, detectPlatform, networkById, rentalLink, stationAgeSeconds } from "@/lib/rental";
import { Icon } from "@/components/ui/primitives";
import { StatusText } from "@/components/ui/FreshnessBadge";
import type { City, Leg, RentalStationRef } from "@/lib/api/types";

/**
 * A shared-vehicle leg inside the itinerary timeline: pick-up card ("Toma una bici en …
 * · 6 bicis disponibles"), the ride, drop-off card ("Deja la bici en … · 4 puestos libres"),
 * availability freshness, the price line and the network's own app/site hand-off.
 */
export function RentalLegBlock({ leg, city, open, onToggle }: { leg: Leg; city: City; open: boolean; onToggle: () => void }) {
  const { t, lang } = useI18n();
  const r = leg.rental!;
  const network = networkById(city, r.networkId);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  useEffect(() => setPlatform(detectPlatform(navigator.userAgent)), []);
  const link = rentalLink(network ?? { id: r.networkId, name: r.networkName, network: "", gbfsUrl: "", color: r.color, url: null, apps: null, pricingSummary: null, formFactors: [] }, platform);
  const noBikes = r.pickup?.vehiclesAvailable != null && r.pickup.vehiclesAvailable <= 0;

  return (
    <div className="mt-1.5 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-sm font-extrabold text-white" style={{ background: r.color }}>
          <Icon.Bike width={14} height={14} /> {r.networkName}
        </span>
        <span className="text-sm text-ink-2">
          {r.vehicleType === "electric_assist" ? t.rental.ebikes(1).replace(/^1 /, "") : r.vehicleType === "scooter" ? t.mode.SCOOTER : t.mode.BICYCLE}
        </span>
      </div>

      {r.pickup ? <StationCard kind="pickup" ref_={r.pickup} color={r.color} /> : null}

      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
        <button type="button" onClick={onToggle} className="inline-flex items-center gap-1 font-semibold text-signal" aria-expanded={open}>
          <Icon.Chevron width={14} height={14} className={`transition-transform ${open ? "rotate-90" : ""}`} />
          {t.rental.ride} · {fmtDuration(leg.durationSeconds, lang)} · {fmtDistance(leg.distanceMeters, lang)}
        </button>
        {r.priceEstimate ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-paper-3 px-1.5 py-0.5 font-semibold text-ink">
            <Icon.Fare width={12} height={12} />
            {r.priceEstimate.label} · <span className="tabular-nums">{fmtMoney(r.priceEstimate.amount, r.priceEstimate.currency, lang)}</span>
            {r.priceEstimate.estimated ? <span aria-hidden>≈</span> : null}
          </span>
        ) : null}
      </div>
      {open && leg.steps.length ? (
        <ol className="flex flex-col gap-0.5 pl-1 text-xs text-ink-2">
          {leg.steps.map((st, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>{st.instruction || `${(t.direction as Record<string, string>)[st.relativeDirection] ?? t.direction.CONTINUE} ${st.streetName}`.trim()}</span>
              <span className="shrink-0 tabular-nums text-ink-3">{fmtDistance(st.distanceMeters, lang)}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {r.dropoff ? <StationCard kind="dropoff" ref_={r.dropoff} color={r.color} /> : null}

      {noBikes ? <p className="text-xs font-semibold text-brick">{t.rental.unavailable}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {link ? (
          <a href={link} target="_blank" rel="noreferrer noopener" className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-bold" style={{ borderColor: r.color, color: r.color }}>
            {t.rental.open(r.networkName)} <Icon.External width={12} height={12} />
          </a>
        ) : null}
        <span className="text-[11px] text-ink-3">{t.rental.dataFrom(r.networkName)}</span>
      </div>
    </div>
  );
}

function StationCard({ kind, ref_, color }: { kind: "pickup" | "dropoff"; ref_: RentalStationRef; color: string }) {
  const { t } = useI18n();
  const age = stationAgeSeconds(ref_.lastReported);
  const count = kind === "pickup" ? ref_.vehiclesAvailable : ref_.docksAvailable;
  const tone = availabilityTone(count);
  const label =
    count == null
      ? null
      : kind === "pickup"
        ? tone === "none"
          ? t.rental.none
          : t.rental.bikesAvailable(count)
        : count <= 0
          ? t.rental.full
          : t.rental.docksFree(count);
  return (
    <div className="rounded-xl border border-line bg-paper p-2.5" style={{ borderLeftWidth: 4, borderLeftColor: color }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{kind === "pickup" ? t.rental.pickup : t.rental.dropoff}</p>
      <p className="truncate text-sm font-bold">{ref_.name}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
        {label ? <span className={`font-semibold ${tone === "none" || (kind === "dropoff" && count != null && count <= 0) ? "text-brick" : tone === "low" ? "text-amber-ink" : "text-moss"}`}>{label}</span> : null}
        {age != null ? <StatusText tone={age > 180 ? "stale" : "live"} label={t.rental.updatedAgo(age)} live={false} /> : null}
      </p>
    </div>
  );
}
