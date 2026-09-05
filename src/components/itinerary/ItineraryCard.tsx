"use client";

import { useI18n } from "@/lib/i18n/provider";
import { fmtDistance, fmtDuration, fmtTime } from "@/lib/format";
import { Badge, Icon } from "@/components/ui/primitives";
import { StatusText } from "@/components/ui/FreshnessBadge";
import { FareTag } from "@/components/ui/FareTag";
import { RouteStrip } from "./RouteStrip";
import { estimateFare } from "@/lib/fare";
import type { CityFares, Itinerary } from "@/lib/api/types";

export function ItineraryCard({
  itinerary,
  tz,
  selected,
  onSelect,
  index,
  fares,
}: {
  itinerary: Itinerary;
  tz: string;
  selected: boolean;
  onSelect: () => void;
  index: number;
  fares?: CityFares | null;
}) {
  const { t, lang } = useI18n();
  const fare = estimateFare(itinerary, fares);
  const rentals = itinerary.legs.filter((l) => l.rental).map((l) => l.rental!);
  const rentalNets = [...new Map(rentals.map((r) => [r.networkId, r])).values()];
  const bike = itinerary.legs.some((l) => l.mode === "BICYCLE" && !l.rental);
  const live = itinerary.legs.some((l) => l.realtime);
  const hasAlerts = itinerary.legs.some((l) => l.alerts.length);
  const canceled = itinerary.legs.some((l) => l.realtimeState === "CANCELED");

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-card border p-3 text-left transition-colors ${selected ? "border-ink bg-paper-2 ring-1 ring-ink" : "border-line bg-paper-2 hover:border-line-2"}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-lg font-extrabold tabular-nums tracking-tight">
          {fmtTime(itinerary.startTime, tz, lang)}
          <span className="mx-1.5 text-ink-3">–</span>
          {fmtTime(itinerary.endTime, tz, lang)}
        </span>
        <span className="text-base font-bold tabular-nums">{fmtDuration(itinerary.durationSeconds, lang)}</span>
      </div>

      <div className="mt-2">
        <RouteStrip itinerary={itinerary} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
        <span className="font-semibold text-ink">{t.planner.transfers(itinerary.transfers)}</span>
        <span className="inline-flex items-center gap-1">
          <Icon.Walk width={14} height={14} />
          {fmtDistance(itinerary.walkDistanceMeters, lang)}
        </span>
        {itinerary.waitingTimeSeconds > 60 ? (
          <span>
            {fmtDuration(itinerary.waitingTimeSeconds, lang)} {t.planner.wait}
          </span>
        ) : null}
        {rentalNets.map((r) => (
          <span key={r.networkId} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: r.color }} title={t.rental.inItinerary}>
            <Icon.Bike width={12} height={12} /> {r.networkName}
          </span>
        ))}
        {bike ? (
          <span className="inline-flex items-center gap-1 text-moss">
            <Icon.Bike width={14} height={14} /> {t.mode.BICYCLE}
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-1">
          {canceled ? <Badge tone="bad">{t.planner.canceled}</Badge> : null}
          {live && !canceled ? <StatusText tone="live" label={t.planner.realtime} live={false} /> : null}
          {hasAlerts ? (
            <Badge tone="warn">
              <Icon.Alert width={12} height={12} />
            </Badge>
          ) : null}
          {itinerary.accessible ? <Badge tone="info">{t.planner.accessible}</Badge> : null}
        </span>
      </div>
      <div className="mt-2">
        <FareTag fare={fare} interactive={false} />
      </div>
      <span className="sr-only">
        {t.planner.results} {index + 1}
      </span>
    </button>
  );
}
