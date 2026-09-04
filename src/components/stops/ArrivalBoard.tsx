"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { fmtDelay } from "@/lib/format";
import { EmptyState, Spinner } from "@/components/ui/primitives";
import { RouteChip } from "@/components/ui/RouteChip";
import { FreshnessBadge } from "@/components/ui/FreshnessBadge";
import { serviceStatus } from "@/lib/service-window";
import { cleanHeadsign } from "@/lib/text";
import type { BoardResponse } from "@/lib/api/types";

/**
 * Arrival board grouped by route (Maas layout, TransMi labels):
 * "Siguiente en 5 min · luego 10, 15 y 20", one live/scheduled badge per time.
 */
export function ArrivalBoard({ board, city, refreshing, onPickRoute }: { board: BoardResponse; city: string; refreshing?: boolean; onPickRoute?: (routeId: string) => void }) {
  const { t, lang } = useI18n();
  if (!board.rows.length) return <EmptyState title={t.board.none} />;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-ink-3">
        <FreshnessBadge freshness={board.freshness} realtime={board.freshness.realtime && !board.freshness.stale} />
        {refreshing ? (
          <span className="inline-flex items-center gap-1">
            <Spinner className="h-3 w-3" /> {t.stop.refreshing}
          </span>
        ) : null}
      </div>
      <ul className="divide-y divide-line rounded-card border border-line bg-paper-2">
        {board.rows.map((row) => {
          const [first, ...rest] = row.next;
          const svc = serviceStatus(t, row.route);
          return (
            <li key={row.route.id} className="flex items-start gap-3 px-3 py-2">
              {onPickRoute ? (
                <button type="button" onClick={() => onPickRoute(row.route.id)} className="inline-flex min-h-11 shrink-0 items-center" aria-label={row.route.shortName}>
                  <RouteChip route={row.route} />
                </button>
              ) : (
                <Link href={`/${city}/routes/${encodeURIComponent(row.route.id)}`} className="inline-flex min-h-11 shrink-0 items-center">
                  <RouteChip route={row.route} />
                </Link>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{cleanHeadsign(row.headsign) ?? cleanHeadsign(row.route.longName)}</p>
                {first ? (
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-xs text-ink-2">
                    <span>{t.board.nextIn}</span>
                    <span className={`text-base font-extrabold tabular-nums ${first.realtime ? "text-ink" : "text-ink-2"}`} aria-live="polite">{t.stop.inMin(first.minutes)}</span>
                    <FreshnessBadge freshness={board.freshness} realtime={first.realtime} />
                    {first.realtime && first.delaySeconds != null && Math.abs(first.delaySeconds) >= 60 ? (
                      <span className="text-ink-3">({fmtDelay(first.delaySeconds, lang)})</span>
                    ) : null}
                  </p>
                ) : null}
                {rest.length ? (
                  <p className="mt-0.5 text-xs text-ink-3">
                    {t.board.then}{" "}
                    {rest.map((n, i) => (
                      <span key={n.time}>
                        <span className={`tabular-nums ${n.realtime ? "font-semibold text-ink-2" : ""}`} title={n.realtime ? t.freshness.live : t.freshness.scheduled}>
                          {n.minutes}
                          {n.realtime ? <span className="live-dot ml-0.5 inline-block align-middle" style={{ width: 4, height: 4 }} /> : null}
                        </span>
                        {i < rest.length - 2 ? ", " : i === rest.length - 2 ? ` ${t.board.and} ` : ""}
                      </span>
                    ))}{" "}
                    {t.common.min}
                  </p>
                ) : null}
                {svc.active === false ? <p className="mt-0.5 text-xs font-semibold text-brick">{svc.label}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
