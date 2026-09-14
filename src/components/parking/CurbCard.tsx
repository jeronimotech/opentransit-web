"use client";

import { useI18n } from "@/lib/i18n/provider";
import { availabilityAgeSeconds, PARKING_COLORS, parkingTone } from "@/lib/parking";
import { fmtTime } from "@/lib/format";
import { Icon } from "@/components/ui/primitives";
import { StatusText } from "@/components/ui/FreshnessBadge";
import type { City, CurbZone } from "@/lib/api/types";

/**
 * The paid-parking zone "popup": spaces as of when the operator last said, whether a car may park
 * right now and until when, the price, and "Salir desde aquí" — the way a park & ride starts by hand.
 */
export function CurbCard({ city, zone, onClose, onPlanFrom, onDirections }: { city: City; zone: CurbZone; onClose: () => void; onPlanFrom?: (z: CurbZone) => void; onDirections?: (z: CurbZone) => void }) {
  const { t, lang } = useI18n();
  const tone = parkingTone(zone);
  const color = PARKING_COLORS[tone];
  const age = availabilityAgeSeconds(zone.availabilityTime);
  const spaces =
    zone.availableSpaces == null
      ? t.parking.unknownSpaces
      : zone.availableSpaces <= 0
        ? t.parking.full
        : zone.totalSpaces != null
          ? t.parking.spacesOf(zone.availableSpaces, zone.totalSpaces)
          : t.parking.spaces(zone.availableSpaces);
  const facts = [
    { key: "spaces", text: spaces, cls: `font-bold ${tone === "full" || tone === "closed" ? "text-brick" : tone === "low" ? "text-amber-ink" : "text-ink"}` },
    ...(zone.priceLabel ? [{ key: "price", text: zone.priceLabel, cls: "text-ink-2" }] : []),
  ];

  return (
    <div role="dialog" aria-label={zone.name ?? t.parking.zone} className="absolute left-3 right-3 z-20 rounded-2xl border border-line bg-paper-2/95 p-3 shadow-card backdrop-blur md:left-auto md:right-4 md:w-[340px]" style={{ bottom: "calc(var(--sheet-h, 0px) + 12px)" }}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: color }} aria-hidden>
          <Icon.Parking width={20} height={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t.parking.zone}</p>
          <h2 className="truncate text-[15px] font-extrabold leading-tight">{zone.name ?? zone.streetName ?? t.parking.zone}</h2>
          {zone.name && zone.streetName ? <p className="truncate text-xs text-ink-3">{zone.streetName}</p> : null}
          <p className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
            {facts.map((f, i) => (
              <span key={f.key} className={f.cls}>
                {f.text}
                {i < facts.length - 1 ? <span className="text-ink-3">{"\u00A0·"}</span> : null}
              </span>
            ))}
          </p>
          <p className="mt-1 text-xs text-ink-2">
            {zone.allowed === false ? <span className="font-semibold text-brick">{t.parking.notNow}</span> : zone.allowed ? <span className="font-semibold text-moss">{t.parking.allowedNow}</span> : null}
            {zone.allowed && zone.nextChange ? ` · ${t.parking.until(fmtTime(zone.nextChange, city.timezone, lang))}` : ""}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-3">
            {age != null ? <StatusText tone={age > 900 ? "stale" : "live"} label={t.parking.countedAgo(age)} live={false} /> : <span>{t.parking.noCount}</span>}
          </div>
        </div>
        <button type="button" onClick={onClose} className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-paper-3 hover:text-ink" aria-label={t.common.close}>
          <Icon.Close width={16} height={16} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {onDirections ? (
          <button type="button" onClick={() => onDirections(zone)} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-bold text-paper">
            <Icon.Route width={16} height={16} /> {t.rental.directions}
          </button>
        ) : null}
        {onPlanFrom ? (
          <button type="button" onClick={() => onPlanFrom(zone)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-line bg-paper-2 px-3 text-sm font-semibold text-ink-2 hover:border-ink hover:text-ink">
            {t.parking.continueByTransit}
          </button>
        ) : null}
      </div>
    </div>
  );
}
