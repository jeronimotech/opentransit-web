"use client";

import { useI18n } from "@/lib/i18n/provider";
import { fmtDistance, fmtDuration, fmtTime } from "@/lib/format";
import { Badge, Icon } from "@/components/ui/primitives";
import { RouteStrip } from "./RouteStrip";
import type { Itinerary } from "@/lib/api/types";

export function ItineraryCard({
  itinerary,
  tz,
  selected,
  onSelect,
  index,
}: {
  itinerary: Itinerary;
  tz: string;
  selected: boolean;
  onSelect: () => void;
  index: number;
}) {
  const { t, lang } = useI18n();
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
        <span className="ml-auto flex items-center gap-1">
          {canceled ? <Badge tone="bad">{t.planner.canceled}</Badge> : null}
          {live && !canceled ? (
            <Badge tone="live">
              <span className="live-dot" style={{ width: 6, height: 6 }} />
              {t.planner.realtime}
            </Badge>
          ) : null}
          {hasAlerts ? (
            <Badge tone="warn">
              <Icon.Alert width={12} height={12} />
            </Badge>
          ) : null}
          {itinerary.accessible ? <Badge tone="info">{t.planner.accessible}</Badge> : null}
        </span>
      </div>
      <span className="sr-only">
        {t.planner.results} {index + 1}
      </span>
    </button>
  );
}
