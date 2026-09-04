"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n/provider";
import { useAlertInbox } from "@/lib/alert-inbox";
import { Icon } from "@/components/ui/primitives";
import { RouteChip } from "@/components/ui/RouteChip";
import type { Alert } from "@/lib/api/types";

const TONE: Record<string, string> = {
  SEVERE: "border-brick/40 bg-brick-soft",
  WARNING: "border-amber/60 bg-amber/15",
  INFO: "border-line bg-paper-2",
};

/** Home "mensajes de interés": severity-sorted, dismissible, capped impressions. */
export function AlertCarousel({ city, alerts }: { city: string; alerts: Alert[] }) {
  const t = useT();
  const { visible, dismiss, markShown } = useAlertInbox(city, alerts, 4);
  const shown = useRef<string>("");
  useEffect(() => {
    const ids = visible.map((a) => a.id).join("|");
    if (ids && ids !== shown.current) {
      shown.current = ids;
      markShown(visible.map((a) => a.id));
    }
  }, [visible, markShown]);

  if (!visible.length) return null;
  return (
    <section aria-label={t.hub.messages}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink-2">{t.hub.messages}</h2>
        <Link href={`/${city}/alerts`} className="text-xs font-semibold text-signal">
          {t.nav.alerts} →
        </Link>
      </div>
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {visible.map((a) => (
          <article key={a.id} className={`relative w-[260px] shrink-0 snap-start rounded-lg border p-3 ${TONE[a.severity ?? "INFO"] ?? TONE.INFO}`}>
            <button type="button" onClick={() => dismiss(a.id)} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md text-ink-3 hover:bg-paper-3 hover:text-ink" aria-label={t.hub.dismiss}>
              <Icon.Close width={14} height={14} />
            </button>
            <p className="pr-6 text-xs font-bold leading-snug line-clamp-2">{a.header}</p>
            <div className="mt-2 flex items-center gap-1">
              {a.routes.slice(0, 4).map((r) => (
                <RouteChip key={r.id} route={r} size="sm" />
              ))}
              {a.url ? (
                <a href={a.url} target="_blank" rel="noreferrer" className="ml-auto text-[11px] font-semibold text-signal hover:underline">
                  {t.alerts.more}
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
