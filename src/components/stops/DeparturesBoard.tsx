"use client";

import { cleanHeadsign } from "@/lib/text";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { fmtDelay, fmtTime, minutesUntil } from "@/lib/format";
import { Badge, EmptyState, Spinner } from "@/components/ui/primitives";
import { RouteChip } from "@/components/ui/RouteChip";
import type { Departure } from "@/lib/api/types";

export function DeparturesBoard({
  departures,
  tz,
  city,
  generatedAt,
  refreshing,
}: {
  departures: (Departure & { platform?: string })[];
  tz: string;
  city: string;
  generatedAt: string | null;
  refreshing?: boolean;
}) {
  const { t, lang } = useI18n();
  if (!departures.length) return <EmptyState title={t.stop.noDepartures} />;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-ink-3">
        <span>
          {t.stop.updated} {generatedAt ? fmtTime(generatedAt, tz, lang) : "—"}
        </span>
        {refreshing ? (
          <span className="inline-flex items-center gap-1">
            <Spinner className="h-3 w-3" /> {t.stop.refreshing}
          </span>
        ) : null}
      </div>
      <ul className="divide-y divide-line rounded-card border border-line bg-paper-2">
        {departures.map((d) => {
          const when = d.realtimeTime ?? d.scheduledTime;
          const mins = minutesUntil(when);
          const delay = fmtDelay(d.delaySeconds, lang);
          return (
            <li key={`${d.tripId}-${d.scheduledTime}`} className={`flex items-center gap-3 px-3 py-2.5 ${d.canceled ? "opacity-60" : ""}`}>
              <Link href={`/${city}/routes/${encodeURIComponent(d.route.id)}`} className="shrink-0">
                <RouteChip route={d.route} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{cleanHeadsign(d.headsign)}</p>
                <p className="flex items-center gap-1.5 text-xs text-ink-3">
                  <span className="tabular-nums">{fmtTime(d.scheduledTime, tz, lang)}</span>
                  {d.platform ? <span className="truncate">· {d.platform}</span> : null}
                  {d.canceled ? (
                    <Badge tone="bad">{t.planner.canceled}</Badge>
                  ) : d.realtime ? (
                    <Badge tone={d.delaySeconds && d.delaySeconds > 180 ? "warn" : "ok"}>
                      <span className="live-dot" style={{ width: 5, height: 5 }} />
                      {delay}
                    </Badge>
                  ) : null}
                </p>
              </div>
              <span className={`shrink-0 text-right text-base font-extrabold tabular-nums ${d.realtime ? "text-ink" : "text-ink-2"}`}>
                {d.canceled ? "—" : t.stop.inMin(mins)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
