"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useForecast } from "@/lib/api/hooks";
import { isNotFound } from "@/lib/api/hooks";
import { useNow } from "@/lib/use-now";
import { minutesTo, recommendedIndex, toRows } from "@/lib/forecast";
import { fmtDuration, fmtTime } from "@/lib/format";
import { Badge, EmptyState, Icon, Spinner } from "@/components/ui/primitives";
import type { City, Mode } from "@/lib/api/types";

/**
 * "Cuándo salir" (Lote 2 B2). The same trip planned across the next window, as a
 * timeline: every possible departure with its arrival, the recommended one marked,
 * long service gaps drawn *between* the rows where they happen, and the last
 * departure flagged. Picking a row re-plans the trip at that time.
 */
export function DepartureForecast({
  city,
  from,
  to,
  modes,
  windowMinutes = 90,
  onPick,
  onClose,
}: {
  city: City;
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  modes?: Mode[];
  windowMinutes?: number;
  onPick: (departAt: string) => void;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const now = useNow(30_000);
  const q = useForecast(city.id, { fromLat: from.lat, fromLon: from.lon, toLat: to.lat, toLon: to.lon, modes, windowMinutes, locale: lang }, true);
  const rows = useMemo(() => toRows(q.data), [q.data]);
  const bestIdx = useMemo(() => recommendedIndex(rows), [rows]);

  return (
    <section aria-labelledby="forecast-title" data-testid="forecast" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 id="forecast-title" className="text-sm font-bold">
            {t.lote23.forecast.title}
          </h3>
          <p className="text-xs text-ink-3">
            {t.lote23.forecast.hint} · {t.lote23.forecast.window(windowMinutes)}
          </p>
        </div>
        <button type="button" onClick={onClose} className="inline-flex h-8 items-center gap-1 px-1 text-xs font-semibold text-ink-3 hover:text-ink" aria-label={t.common.close}>
          <Icon.Close width={14} height={14} />
        </button>
      </div>

      {q.isLoading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-ink-2">
          <Spinner /> {t.planner.loading}
        </div>
      ) : q.error ? (
        <EmptyState title={isNotFound(q.error) ? t.lote23.forecast.unavailable : t.common.error} hint={isNotFound(q.error) ? undefined : (q.error as Error).message} icon={<Icon.Clock />} />
      ) : !rows.length ? (
        <EmptyState title={t.lote23.forecast.empty} icon={<Icon.Clock />} />
      ) : (
        <ol className="flex flex-col" data-testid="forecast-rows">
          {rows.map((r, i) => {
            const mins = minutesTo(r.option.departAt, now);
            const departed = mins < -1;
            const isBest = i === bestIdx;
            return (
              <li key={r.option.departAt} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => onPick(r.option.departAt)}
                  disabled={departed}
                  data-testid="forecast-row"
                  data-recommended={isBest ? "1" : undefined}
                  className={`grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                    departed ? "border-transparent opacity-45" : isBest ? "border-moss bg-moss-soft hover:border-ink" : "border-line bg-paper-2 hover:border-ink"
                  }`}
                  aria-label={`${t.lote23.forecast.pick}: ${fmtTime(r.option.departAt, city.timezone, lang)}`}
                >
                  <span className="tabular-nums">
                    <span className="block text-[15px] font-extrabold leading-tight">{fmtTime(r.option.departAt, city.timezone, lang)}</span>
                    <span className="block text-[11px] text-ink-3">
                      {departed ? t.lote23.forecast.departed : mins <= 1 ? t.lote1.leaveNow : t.lote1.leaveIn(mins)}
                    </span>
                  </span>

                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-2">
                      <span className="font-semibold text-ink">
                        {t.lote23.forecast.arrive} {fmtTime(r.option.arriveAt, city.timezone, lang)}
                      </span>
                      <span>{fmtDuration(r.option.durationSeconds, lang)}</span>
                      <span>{t.planner.transfers(r.option.transfers)}</span>
                      {r.option.realtime ? <span className="live-dot" aria-hidden /> : null}
                    </span>
                    {isBest ? (
                      <span className="mt-0.5 inline-block">
                        <Badge tone="ok">{t.lote23.forecast.recommended}</Badge>
                      </span>
                    ) : null}
                  </span>

                  <Icon.Chevron width={14} height={14} className="rotate-90 text-ink-3" />
                </button>

                {r.gapAfterSeconds ? (
                  <p className="my-1 flex items-center gap-1.5 pl-3 text-[11px] font-semibold text-disruption" data-testid="forecast-gap">
                    <Icon.Clock width={12} height={12} />
                    {rows[i + 1] ? t.lote23.forecast.gapUntil(fmtTime(rows[i + 1].option.departAt, city.timezone, lang)) : t.lote23.forecast.gap(Math.round(r.gapAfterSeconds / 60))}
                  </p>
                ) : null}

                {r.lastService ? (
                  <p className="my-1 pl-3 text-[11px] font-semibold text-ink-3" data-testid="forecast-last">
                    {t.lote23.forecast.lastService}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
