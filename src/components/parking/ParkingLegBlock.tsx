"use client";

import { useI18n } from "@/lib/i18n/provider";
import { fmtDistance, fmtDuration, fmtMoney, fmtTime } from "@/lib/format";
import { availabilityAgeSeconds, PARKING_COLORS, parkingTone } from "@/lib/parking";
import { Icon } from "@/components/ui/primitives";
import { StatusText } from "@/components/ui/FreshnessBadge";
import type { City, Leg, ParkingInfo } from "@/lib/api/types";

/**
 * The car leg of a park & ride itinerary: the drive, then the zone where the car is left with its
 * spaces, price and hours, and the fee for the planned dwell — stated as an estimate for N hours,
 * because that assumption is the whole number.
 */
export function ParkingLegBlock({ leg, parking, city, open, onToggle }: { leg: Leg; parking: ParkingInfo | null; city: City; open: boolean; onToggle: () => void }) {
  const { t, lang } = useI18n();
  const tone = parking ? parkingTone({ availableSpaces: parking.availableSpaces, totalSpaces: parking.totalSpaces, allowed: true }) : "unknown";
  const color = PARKING_COLORS[tone];
  const age = availabilityAgeSeconds(parking?.availabilityTime);
  return (
    <div className="mt-1.5 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-sm font-extrabold text-white" style={{ background: "#1d4ed8" }}>
          <Icon.Car width={14} height={14} /> {t.parking.ownCar}
        </span>
        <button type="button" onClick={onToggle} className="inline-flex items-center gap-1 text-xs font-semibold text-signal" aria-expanded={open}>
          <Icon.Chevron width={14} height={14} className={`transition-transform ${open ? "rotate-90" : ""}`} />
          {fmtDuration(leg.durationSeconds, lang)} · {fmtDistance(leg.distanceMeters, lang)}
        </button>
      </div>
      {parking ? (
        <div className="rounded-xl border border-line bg-paper p-2.5" style={{ borderLeftWidth: 4, borderLeftColor: color }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t.parking.leaveCarAt}</p>
          <p className="truncate text-sm font-bold">{parking.name ?? parking.streetName ?? t.parking.zone}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
            <span className={`font-semibold ${tone === "full" ? "text-brick" : tone === "low" ? "text-amber-ink" : "text-moss"}`}>
              {parking.availableSpaces == null ? t.parking.unknownSpaces : parking.totalSpaces != null ? t.parking.spacesOf(parking.availableSpaces, parking.totalSpaces) : t.parking.spaces(parking.availableSpaces)}
            </span>
            {age != null ? <StatusText tone={age > 900 ? "stale" : "live"} label={t.parking.countedAgo(age)} live={false} /> : null}
          </p>
          <p className="mt-1 text-xs text-ink-2">
            {parking.priceLabel ?? ""}
            {parking.allowedUntil ? ` · ${t.parking.until(fmtTime(parking.allowedUntil, city.timezone, lang))}` : ""}
          </p>
          {parking.fee ? (
            <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-paper-3 px-1.5 py-0.5 text-xs font-semibold text-ink">
              <Icon.Fare width={12} height={12} />
              {t.parking.feeFor(parking.fee.dwellHours)} · <span className="tabular-nums">{fmtMoney(parking.fee.amount, parking.fee.currency, lang)}</span>
              <span aria-hidden>≈</span>
            </p>
          ) : null}
          <p className="mt-1 text-xs text-ink-3">{t.parking.thenWalk(fmtDistance(parking.walkMeters, lang), fmtDuration(parking.walkSeconds, lang))}</p>
        </div>
      ) : null}
    </div>
  );
}
