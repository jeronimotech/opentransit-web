"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { fmtDistance, fmtTime } from "@/lib/format";
import { EmptyState, Icon } from "@/components/ui/primitives";
import { cleanHeadsign } from "@/lib/text";
import { FreshnessBadge, StatusText } from "@/components/ui/FreshnessBadge";
import { RouteChip } from "@/components/ui/RouteChip";
import { etaBucket, ETA_COLORS } from "@/lib/eta";
import type { NextResponse } from "@/lib/api/types";

/** "Ubica tu bus" rows: each one says En vivo / Por programación / Estimado, never fakes. */
export function NextBuses({ data, city, tz }: { data: NextResponse; city: string; tz: string }) {
  const { t, lang } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <RouteChip route={data.route} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{cleanHeadsign(data.route.longName)}</p>
          <p className="truncate text-xs text-ink-3">{data.stop.name}</p>
        </div>
        <FreshnessBadge freshness={data.freshness} realtime={data.freshness.realtime && !data.freshness.stale} className="ml-auto" />
      </div>
      {!data.next.length ? <EmptyState title={t.next.none} /> : null}
      <ol className="divide-y divide-line rounded-card border border-line bg-paper-2">
        {data.next.map((n, i) => {
          const b = etaBucket(n.minutes);
          const tone = n.source === "live" ? "live" : n.source === "estimated" ? "estimated" : "scheduled";
          return (
            <li key={`${n.tripId ?? i}-${n.time}`} className="flex items-center gap-3 px-3 py-2.5">
              <span className="grid h-11 w-14 shrink-0 place-items-center rounded-lg text-white" style={{ background: ETA_COLORS[b] || "var(--ink-3)" }}>
                <span className="text-lg font-extrabold leading-none tabular-nums" aria-live="polite">{n.minutes <= 0 ? "•" : n.minutes}</span>
                <span className="text-[10px] font-semibold">{n.minutes <= 0 ? t.next.arrivingNow : t.common.min}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm">
                  <StatusText tone={tone} label={n.source === "live" ? t.next.live : n.source === "estimated" ? t.next.estimated : t.next.scheduled} />
                  <span className="tabular-nums text-ink-2">{fmtTime(n.time, tz, lang)}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-3">
                  {n.stopsAway != null ? t.next.stopsAway(n.stopsAway) : null}
                  {n.stopsAway != null && n.distanceMeters != null ? " · " : null}
                  {n.distanceMeters != null ? `${fmtDistance(n.distanceMeters, lang)} ${t.next.away}` : null}
                  {n.vehicle?.label ? ` · ${n.vehicle.label}` : null}
                </p>
              </div>
              {n.vehicle ? (
                <Link href={`/${city}/live?vehicle=${encodeURIComponent(n.vehicle.id)}`} className="shrink-0 text-ink-3 hover:text-ink" aria-label={t.next.seeVehicle} title={t.next.seeVehicle}>
                  <Icon.Map width={18} height={18} />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
