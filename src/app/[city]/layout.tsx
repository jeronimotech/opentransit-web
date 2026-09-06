"use client";

import Link from "next/link";
import { use } from "react";
import { useCity } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n/provider";
import { CityProvider } from "@/components/shell/CityContext";
import { CityHeader, Wordmark } from "@/components/shell/CityHeader";
import { Spinner } from "@/components/ui/primitives";
import { ApiRequestError } from "@/lib/api/client";
import { resolveConfig } from "@/lib/city-config";
import { Icon } from "@/components/ui/primitives";
import { NetBar } from "@/components/shell/NetBar";

export default function CityLayout({ children, params }: { children: React.ReactNode; params: Promise<{ city: string }> }) {
  const { city } = use(params);
  const { data, isLoading, error, refetch } = useCity(city);
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="grid h-dvh place-items-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (error || !data) {
    const notFound = error instanceof ApiRequestError && error.status === 404;
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8">
        <Link href="/">
          <Wordmark className="text-lg" />
        </Link>
        <h1 className="mt-16 text-2xl font-extrabold">{notFound ? `“${city}”` : t.common.error}</h1>
        <p className="mt-2 text-ink-2">{notFound ? t.chooseCity : (error as Error)?.message}</p>
        <div className="mt-4 flex gap-3">
          <Link href="/" className="font-semibold text-signal">
            {t.chooseCity}
          </Link>
          {!notFound ? (
            <button type="button" className="font-semibold text-signal" onClick={() => refetch()}>
              {t.common.retry}
            </button>
          ) : null}
        </div>
      </main>
    );
  }

  const cfg = resolveConfig(data);
  return (
    <CityProvider city={data}>
      <NetBar city={data.id} />
      <CityHeader city={data} />
      {cfg.maintenance.active ? (
        <div role="status" className="pointer-events-none fixed inset-x-0 top-[60px] z-30 flex justify-center px-3 md:top-[72px]">
          <p className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-amber bg-amber/95 px-3 py-1.5 text-xs font-semibold text-amber-ink shadow-card">
            <Icon.Alert width={14} height={14} />
            {t.config.maintenance} · {cfg.maintenance.message ?? t.config.maintenanceHint}
          </p>
        </div>
      ) : null}
      {children}
    </CityProvider>
  );
}
