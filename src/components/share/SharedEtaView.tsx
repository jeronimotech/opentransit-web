"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MapView, useFitBounds } from "@/components/map/MapView";
import { ItineraryLayer, PinMarker } from "@/components/map/layers";
import { RouteStrip } from "@/components/itinerary/RouteStrip";
import { RouteChip } from "@/components/ui/RouteChip";
import { Icon, Spinner } from "@/components/ui/primitives";
import { Wordmark } from "@/components/shell/CityHeader";
import { useI18n } from "@/lib/i18n/provider";
import { useSharedEta } from "@/lib/api/hooks";
import { isNotFound } from "@/lib/api/hooks";
import { useNow } from "@/lib/use-now";
import { fmtTime } from "@/lib/format";
import { minutesLeft, progressAgeSeconds, shareView, type ShareView } from "@/lib/share";
import { decodeGeometry } from "@/lib/geo";
import type { Itinerary } from "@/lib/api/types";

/** Keep the whole trip in view; the reader never pans this page. */
function FitTrip({ itinerary }: { itinerary: Itinerary }) {
  const bounds = useMemo<[number, number, number, number] | null>(() => {
    const pts = itinerary.legs.flatMap((l) => decodeGeometry(l.geometry));
    if (!pts.length) return null;
    let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [lon, lat] of pts) {
      w = Math.min(w, lon);
      e = Math.max(e, lon);
      s = Math.min(s, lat);
      n = Math.max(n, lat);
    }
    return [w, s, e, n];
  }, [itinerary]);
  useFitBounds(bounds, { top: 70, bottom: 260, left: 40, right: 40 });
  return null;
}

const TONE: Record<ShareView, string> = {
  on_time: "text-moss",
  delayed: "text-disruption",
  arrived: "text-moss",
  ended: "text-ink-3",
  expired: "text-ink-3",
};

/**
 * The public face of a shared trip (Lote 3 C6). No app chrome, no navigation:
 * one map, one ETA, one honest status line, and a way to plan your own trip.
 * It polls while the trip is moving and stops once it has arrived or ended.
 */
export function SharedEtaView({ city, token }: { city: string; token: string }) {
  const { t, lang } = useI18n();
  const now = useNow(10_000);
  const q = useSharedEta(city, token);
  const data = q.data ?? null;
  const view = shareView(data, now);
  const gone = !!q.error || view === "expired" || view === "ended";

  if (q.isLoading) {
    return (
      <main className="grid h-dvh place-items-center">
        <Spinner className="h-6 w-6" />
      </main>
    );
  }

  if (gone) {
    const expired = view === "expired" || isNotFound(q.error);
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <Wordmark className="text-lg" />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight" data-testid="share-gone">
          {expired ? t.lote23.share.expired : t.lote23.share.ended}
        </h1>
        <p className="text-sm text-ink-2">{t.lote23.share.expiredHint}</p>
        <Link href={`/${city}`} className="mt-3 inline-flex h-11 items-center rounded-lg bg-ink px-4 text-sm font-bold text-paper">
          {t.lote23.share.cta}
        </Link>
      </main>
    );
  }

  const it = data!.itinerary;
  const tz = data!.city.timezone;
  const mins = minutesLeft(data, now);
  const age = progressAgeSeconds(data, now);
  const legIndex = data!.progress?.legIndex ?? 0;
  const current = it.legs[Math.min(legIndex, it.legs.length - 1)] ?? null;
  const statusLabel = view === "arrived" ? t.lote23.share.arrived : view === "delayed" ? t.lote23.share.delayed : t.lote23.share.onTime;

  return (
    <main className="relative h-dvh w-full overflow-hidden" data-testid="share-view">
      <MapView
        center={[data!.city.center?.lon ?? it.legs[0].from.lon, data!.city.center?.lat ?? it.legs[0].from.lat]}
        zoom={data!.city.defaultZoom ?? 12}
        attribution={data!.city.attribution ?? undefined}
        className="h-full w-full"
      >
        <ItineraryLayer itinerary={it} />
        <FitTrip itinerary={it} />
        {data!.progress?.lat != null && data!.progress?.lon != null ? <PinMarker kind="user" lat={data!.progress.lat} lon={data!.progress.lon} /> : null}
        <PinMarker kind="to" lat={it.legs[it.legs.length - 1].to.lat} lon={it.legs[it.legs.length - 1].to.lon} />
      </MapView>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-3">
        <span className="pointer-events-auto rounded-full border border-line bg-paper-2/95 px-3 py-1.5 text-xs font-semibold text-ink-2 shadow-card backdrop-blur">
          {t.lote23.share.title}
        </span>
      </header>

      <section className="absolute inset-x-0 bottom-0 z-10 rounded-t-2xl border-t border-line bg-paper-2 p-4 shadow-card">
        <p className="text-xs font-semibold text-ink-3">{data!.label ?? `${it.legs[0].from.name} → ${it.legs[it.legs.length - 1].to.name}`}</p>

        <div className="mt-1 flex items-baseline justify-between gap-3">
          <span className="text-3xl font-extrabold tabular-nums tracking-tight" data-testid="share-eta">
            {fmtTime(data!.progress?.etaAt ?? it.endTime, tz, lang)}
          </span>
          <span className={`text-sm font-bold ${TONE[view]}`} data-testid="share-state">
            {statusLabel}
            {mins !== null && view !== "arrived" ? <span className="ml-1.5 font-semibold text-ink-2">{t.lote23.share.etaIn(mins)}</span> : null}
          </span>
        </div>

        <div className="mt-2">
          <RouteStrip itinerary={it} height={30} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
          {current?.route ? <RouteChip route={current.route} size="sm" /> : null}
          {current ? (
            <span className="truncate font-semibold text-ink">
              {current.to.name}
            </span>
          ) : null}
          <span className="text-ink-3">{t.lote23.share.legOf(Math.min(legIndex + 1, it.legs.length), it.legs.length)}</span>
          <span className="inline-flex items-center gap-1 text-ink-3">
            <span className={`h-1.5 w-1.5 rounded-full ${age !== null && age < 90 ? "bg-moss" : "bg-amber"}`} aria-hidden />
            {age === null ? t.lote23.share.noUpdates : t.lote23.share.updated(age)}
          </span>
        </div>

        <Link href={`/${city}`} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-bold text-paper">
          <Icon.Route width={16} height={16} /> {t.lote23.share.cta}
        </Link>
      </section>
    </main>
  );
}
