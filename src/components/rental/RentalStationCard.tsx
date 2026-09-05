"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useRentalStation } from "@/lib/api/hooks";
import { availabilityTone, detectPlatform, networkById, rentalLink, stationAgeSeconds } from "@/lib/rental";
import { Icon } from "@/components/ui/primitives";
import { StatusText } from "@/components/ui/FreshnessBadge";
import type { City, RentalStation } from "@/lib/api/types";

/**
 * The station "popup": a floating card over the map (phones: above the sheet;
 * desktop: bottom-left). Name, bikes / e-bikes / docks, freshness, "Cómo llegar"
 * (plan to it) and the network's own app/site. Generic over the city's networks.
 */
export function RentalStationCard({
  city,
  station,
  onClose,
  onDirections,
  onPlanFrom,
}: {
  city: City;
  station: RentalStation;
  onClose: () => void;
  onDirections?: (s: RentalStation) => void;
  onPlanFrom?: (s: RentalStation) => void;
}) {
  const { t } = useI18n();
  const detail = useRentalStation(city.id, station.id);
  const s = detail.data ?? station;
  const network = networkById(city, s.networkId) ?? (detail.data?.network as { id: string; name: string; color: string; url: string | null; apps: { ios?: string | null; android?: string | null } | null } | null);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  useEffect(() => setPlatform(detectPlatform(navigator.userAgent)), []);
  const link = network ? rentalLink({ ...network, network: "", gbfsUrl: "", pricingSummary: null, formFactors: [] }, platform) : null;
  const age = stationAgeSeconds(s.lastReported);
  const tone = availabilityTone(s.vehiclesAvailable);
  const color = network?.color ?? "#00A859";
  const ebikes = detail.data ? detail.data.vehicleTypesAvailable.filter((v) => v.propulsion === "electric_assist").reduce((a, v) => a + v.count, 0) : s.ebikesAvailable;

  return (
    <div
      role="dialog"
      aria-label={s.name}
      className="absolute left-3 right-3 z-20 rounded-2xl border border-line bg-paper-2/95 p-3 shadow-card backdrop-blur md:left-auto md:right-4 md:w-[340px]"
      style={{ bottom: "calc(var(--sheet-h, 0px) + 12px)" }}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: color }} aria-hidden>
          <Icon.Bike width={20} height={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{network?.name ?? t.rental.station}</p>
          <h2 className="truncate text-[15px] font-extrabold leading-tight">{s.name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className={`font-bold ${tone === "none" ? "text-brick" : tone === "low" ? "text-amber-ink" : "text-ink"}`}>{tone === "none" ? t.rental.none : t.rental.bikesAvailable(s.vehiclesAvailable)}</span>
            {ebikes > 0 ? <span className="text-ink-2">· {t.rental.ebikes(ebikes)}</span> : null}
            <span className={`text-ink-2 ${s.docksAvailable <= 0 ? "text-brick" : ""}`}>· {s.docksAvailable <= 0 ? t.rental.full : t.rental.docksFree(s.docksAvailable)}</span>
          </p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-3">
            {age != null ? <StatusText tone={age > 180 ? "stale" : "live"} label={t.rental.updatedAgo(age)} live={false} /> : <StatusText tone="scheduled" label={t.rental.noData(network?.name ?? t.rental.station)} live={false} />}
            {tone === "low" ? <span className="font-semibold text-amber-ink">{t.rental.low}</span> : null}
          </div>
        </div>
        <button type="button" onClick={onClose} className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-paper-3 hover:text-ink" aria-label={t.common.close}>
          <Icon.Close width={16} height={16} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {onDirections ? (
          <button type="button" onClick={() => onDirections(s)} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-bold text-paper">
            <Icon.Route width={16} height={16} /> {t.rental.directions}
          </button>
        ) : null}
        {onPlanFrom ? (
          <button type="button" onClick={() => onPlanFrom(s)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-line bg-paper-2 px-3 text-sm font-semibold text-ink-2 hover:border-ink hover:text-ink">
            {t.rental.planFrom}
          </button>
        ) : null}
        {link && network ? (
          <a href={link} target="_blank" rel="noreferrer noopener" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-bold" style={{ borderColor: color, color }}>
            {t.rental.open(network.name)} <Icon.External width={12} height={12} />
          </a>
        ) : null}
      </div>
    </div>
  );
}
