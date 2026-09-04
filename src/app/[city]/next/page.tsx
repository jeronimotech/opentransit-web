"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCityCtx } from "@/components/shell/CityContext";
import { SplitLayout } from "@/components/shell/SplitLayout";
import { MapView, useFitBounds } from "@/components/map/MapView";
import { EtaLegend, StopsLayer, VehiclesLayer } from "@/components/map/layers";
import { NextBuses } from "@/components/next/NextBuses";
import { EmptyState, Icon, Spinner } from "@/components/ui/primitives";
import { RouteChip } from "@/components/ui/RouteChip";
import { ComponentIcon } from "@/components/ui/ComponentIcon";
import { useI18n } from "@/lib/i18n/provider";
import { useGeocode, useNextBuses, useStop } from "@/lib/api/hooks";
import { useVehicleStream } from "@/lib/api/stream";
import { useInterpolatedVehicles } from "@/lib/interpolate";
import { useGeolocation } from "@/lib/use-geolocation";
import { resolveConfig, componentOf, componentsOf, stopComponent } from "@/lib/city-config";
import { serviceStatus } from "@/lib/service-window";
import type { GeocodeResult } from "@/lib/api/types";

export default function NextPage() {
  return (
    <Suspense fallback={null}>
      <Next />
    </Suspense>
  );
}

/** "Ubica tu bus": station → route → next buses (TransMi App's most used flow). */
function Next() {
  const city = useCityCtx();
  const cfg = resolveConfig(city);
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const stopId = sp.get("stop");
  const routeId = sp.get("route");
  const geo = useGeolocation();

  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = setTimeout(() => setQuery(text.trim()), 200);
    return () => clearTimeout(h);
  }, [text]);
  const geocode = useGeocode(city.id, query, geo.pos ?? city.center);
  const stopResults = useMemo(() => (geocode.data?.results ?? []).filter((r) => r.stopId), [geocode.data]);

  const stop = useStop(city.id, stopId ?? "");
  const next = useNextBuses(city.id, stopId, routeId, cfg.vehiclePollSeconds * 1000);

  const set = useCallback(
    (patch: { stop?: string | null; route?: string | null }) => {
      const p = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );

  const pickStop = (r: GeocodeResult) => {
    setText("");
    setOpen(false);
    set({ stop: r.stopId, route: null });
  };

  // live vehicles on the chosen route, tinted by ETA from the `next` rows
  const stream = useVehicleStream(city.id, cfg.features.liveVehicles && !!routeId);
  const raw = useMemo(() => (routeId ? [...stream.vehicles.values()].filter((v) => v.routeId === routeId) : []), [stream.vehicles, routeId]);
  const vehicles = useInterpolatedVehicles(raw, { cap: 200 });
  const etaById = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of next.data?.next ?? []) if (n.vehicle) m.set(n.vehicle.id, n.minutes);
    return m;
  }, [next.data]);
  const compColors = useMemo(() => Object.fromEntries(componentsOf(city).map((c) => [c.id, c.color])), [city]);

  const s = stop.data;
  const routes = useMemo(() => {
    const seen = new Map<string, NonNullable<typeof s>["routes"][number]>();
    for (const r of s?.routes ?? []) if (!seen.has(r.shortName)) seen.set(r.shortName, r);
    return [...seen.values()];
  }, [s]);

  const panel = (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">{t.next.title}</h1>
        <p className="mt-1 text-sm text-ink-2">{t.next.hint}</p>
      </div>

      {/* Step 1 · stop */}
      <section>
        <p className="mb-1 text-xs font-semibold text-ink-2">1 · {t.next.stopLabel}</p>
        {s && !open ? (
          <div className="flex items-center gap-3 rounded-card border border-line bg-paper-2 p-3">
            {(() => {
              const c = componentOf(city, stopComponent(s));
              return (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white" style={{ background: c.color }}>
                  <ComponentIcon icon={c.icon} width={18} height={18} />
                </span>
              );
            })()}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{s.name}</p>
              <p className="truncate text-xs text-ink-3">{s.locationType === "station" ? t.common.station : t.common.stop}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className="text-xs font-semibold text-signal"
            >
              {t.next.change}
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              ref={inputRef}
              className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-[15px] font-medium text-ink placeholder:font-normal placeholder:text-ink-3 focus:border-signal focus:bg-paper-2"
              placeholder={t.next.stopPlaceholder}
              value={text}
              autoFocus={!stopId}
              onChange={(e) => {
                setText(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              aria-label={t.next.stopLabel}
            />
            {open && query.length >= 2 ? (
              <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-paper-2 py-1 shadow-card" role="listbox">
                {geocode.isFetching ? (
                  <li className="px-3 py-2">
                    <Spinner />
                  </li>
                ) : null}
                {stopResults.map((r) => {
                  const c = componentOf(city, r.component);
                  return (
                    <li key={r.id} role="option" aria-selected={false}>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pickStop(r)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-paper-3">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{r.name}</span>
                          <span className="block truncate text-xs text-ink-3">{r.label}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!geocode.isFetching && !stopResults.length ? <li className="px-3 py-2 text-sm text-ink-3">{t.common.noMatches}</li> : null}
              </ul>
            ) : null}
          </div>
        )}
      </section>

      {/* Step 2 · route */}
      {s ? (
        <section>
          <p className="mb-1 text-xs font-semibold text-ink-2">2 · {t.next.routeLabel}</p>
          {stop.isLoading ? <Spinner /> : null}
          {!routes.length ? <EmptyState title={t.stop.noDepartures} /> : null}
          <div className="flex flex-wrap gap-1.5">
            {routes.map((r) => {
              const svc = serviceStatus(t, r);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => set({ route: r.id })}
                  aria-pressed={routeId === r.id}
                  className={`inline-flex min-h-11 items-center rounded-lg ring-offset-2 ring-offset-paper-2 ${routeId === r.id ? "ring-2 ring-ink" : ""} ${svc.active === false ? "opacity-50" : ""}`}
                  title={svc.label ?? r.longName}
                >
                  <RouteChip route={r} />
                </button>
              );
            })}
          </div>
          {!routeId && routes.length ? <p className="mt-2 text-sm text-ink-2">{t.next.pickRoute}</p> : null}
        </section>
      ) : null}

      {/* Step 3 · next buses */}
      {stopId && routeId ? (
        <section>
          <p className="mb-1 text-xs font-semibold text-ink-2">3 · {t.next.results}</p>
          {next.isLoading ? <Spinner /> : null}
          {next.error ? <EmptyState title={t.common.error} hint={(next.error as Error).message} /> : null}
          {next.data ? <NextBuses data={next.data} city={city.id} tz={city.timezone} /> : null}
          {s ? (
            <Link href={`/${city.id}/stops/${encodeURIComponent(s.id)}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-signal">
              {t.board.allRoutes} <Icon.Chevron width={14} height={14} />
            </Link>
          ) : null}
        </section>
      ) : null}
    </div>
  );

  return (
    <SplitLayout
      defaultSnap="half"
      panel={panel}
      map={
        <MapView center={[city.center.lon, city.center.lat]} zoom={city.defaultZoom} attribution={city.attribution} className="h-full w-full">
          {s ? <StopsLayer stops={[s]} /> : null}
          {s ? <Center lat={s.lat} lon={s.lon} /> : null}
          {vehicles.length ? <VehiclesLayer vehicles={vehicles} etaById={etaById} colors={compColors} dimOthers focus onClick={(v) => router.push(`/${city.id}/live?vehicle=${encodeURIComponent(v.id)}`)} /> : null}
          {routeId && etaById.size ? <EtaLegend labels={{ title: t.live.legend, now: t.live.bucketNow, soon: t.live.bucketSoon, later: t.live.bucketLater, far: t.live.bucketFar }} /> : null}
        </MapView>
      }
    />
  );
}

function Center({ lat, lon }: { lat: number; lon: number }) {
  useFitBounds([lon, lat, lon, lat]);
  return null;
}
