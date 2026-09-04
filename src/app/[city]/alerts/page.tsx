"use client";

import { useCityCtx } from "@/components/shell/CityContext";
import { AlertCard } from "@/components/alerts/AlertCard";
import { EmptyState, Spinner } from "@/components/ui/primitives";
import { useAlerts } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n/provider";

export default function AlertsPage() {
  const city = useCityCtx();
  const { t } = useI18n();
  const { data, isLoading, error, refetch } = useAlerts(city.id);
  const alerts = data?.alerts ?? [];
  const order = { SEVERE: 0, WARNING: 1, INFO: 2 } as const;
  const sorted = [...alerts].sort((a, b) => (order[a.severity ?? "INFO"] ?? 2) - (order[b.severity ?? "INFO"] ?? 2));

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-24 md:pt-28">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t.alerts.title}</h1>
      <p className="mt-1 text-sm text-ink-2">{t.alerts.hint}</p>
      <div className="mt-6 flex flex-col gap-3">
        {isLoading ? <Spinner /> : null}
        {error ? (
          <EmptyState
            title={t.common.error}
            action={
              <button type="button" onClick={() => refetch()} className="text-sm font-semibold text-signal">
                {t.common.retry}
              </button>
            }
          />
        ) : null}
        {!isLoading && !error && sorted.length === 0 ? <EmptyState title={t.alerts.none} /> : null}
        {sorted.map((a) => (
          <AlertCard key={a.id} alert={a} tz={city.timezone} city={city.id} />
        ))}
      </div>
    </main>
  );
}
