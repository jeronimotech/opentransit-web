"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { fmtDateTime } from "@/lib/format";
import { Icon } from "@/components/ui/primitives";
import { RouteChip } from "@/components/ui/RouteChip";
import type { Alert } from "@/lib/api/types";

const TONE: Record<string, string> = {
  SEVERE: "border-brick/40 bg-brick-soft",
  WARNING: "border-amber/60 bg-amber/15",
  INFO: "border-line bg-paper-3",
};

export function AlertCard({ alert, tz, compact = false, city }: { alert: Alert; tz: string; compact?: boolean; city?: string }) {
  const { t, lang } = useI18n();
  const tone = TONE[alert.severity ?? "INFO"] ?? TONE.INFO;
  return (
    <article className={`rounded-lg border ${tone} ${compact ? "px-2.5 py-2" : "p-4"}`}>
      <div className="flex items-start gap-2">
        <Icon.Alert className={`mt-0.5 shrink-0 ${alert.severity === "SEVERE" ? "text-brick" : "text-ink-2"}`} width={compact ? 14 : 18} height={compact ? 14 : 18} />
        <div className="min-w-0 flex-1">
          <p className={`font-bold leading-snug ${compact ? "text-xs" : "text-base"}`}>{alert.header}</p>
          {!compact && alert.description ? <p className="mt-1 text-sm text-ink-2">{alert.description}</p> : null}
          {!compact ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {alert.routes.length ? <span className="text-xs text-ink-2">{t.alerts.affects}</span> : null}
              {alert.routes.map((r) =>
                city ? (
                  <Link key={r.id} href={`/${city}/routes/${encodeURIComponent(r.id)}`}>
                    <RouteChip route={r} size="sm" />
                  </Link>
                ) : (
                  <RouteChip key={r.id} route={r} size="sm" />
                ),
              )}
              {alert.stopIds.length ? <span className="text-xs text-ink-3">· {t.alerts.stops(alert.stopIds.length)}</span> : null}
            </div>
          ) : null}
          {!compact ? (
            <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-ink-3">
              {alert.start ? (
                <span>
                  {t.alerts.since} {fmtDateTime(alert.start, tz, lang)}
                </span>
              ) : null}
              {alert.end ? (
                <span>
                  {t.alerts.until} {fmtDateTime(alert.end, tz, lang)}
                </span>
              ) : null}
              {alert.url ? (
                <a href={alert.url} target="_blank" rel="noreferrer" className="font-semibold text-signal hover:underline">
                  {t.alerts.more}
                </a>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
