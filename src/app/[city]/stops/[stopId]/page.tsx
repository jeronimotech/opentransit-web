"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useMemo, useState } from "react";
import { useCityCtx } from "@/components/shell/CityContext";
import { SplitLayout } from "@/components/shell/SplitLayout";
import { MapView, useFitBounds } from "@/components/map/MapView";
import { EtaLegend, MapToggle, PoisLayer, StopsLayer, VehiclesLayer, useMapBounds } from "@/components/map/layers";
import { ArrivalBoard } from "@/components/stops/ArrivalBoard";
import { DeparturesBoard } from "@/components/stops/DeparturesBoard";
import { AlertCard } from "@/components/alerts/AlertCard";
import { EmptyState, Icon, LinkButton, Spinner } from "@/components/ui/primitives";
import { RouteChip } from "@/components/ui/RouteChip";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { QrPanel } from "@/components/ui/QrPanel";
import { PqrsLink } from "@/components/ui/AgencyLinks";
import { ComponentIcon } from "@/components/ui/ComponentIcon";
import { isNotFound, useAlerts, useBoard, useDepartures, useDeparturesMulti, useNearbyStops, usePois, useStop } from "@/lib/api/hooks";
import { useVehicleStream } from "@/lib/api/stream";
import { useInterpolatedVehicles } from "@/lib/interpolate";
import { useI18n } from "@/lib/i18n/provider";
import { resolveConfig, componentOf, componentsOf, stopComponent } from "@/lib/city-config";
import { onDemandEnabled } from "@/lib/ondemand";
import type { Stop, StopDetail } from "@/lib/api/types";

/**
 * Stop / station page (UX audit D): header → arrival board first → "Ubica tu bus" as a
 * text link in the board header → routes collapsed → accessibility as one muted line.
 * Phones get a short map strip with "Ver en mapa"; desktop keeps the side-by-side map.
 */
export default function StopPage({ params }: { params: Promise<{ stopId: string }> }) {
  const { stopId: raw } = use(params);
  const stopId = decodeURIComponent(raw);
  const city = useCityCtx();
  const cfg = resolveConfig(city);
  const { t } = useI18n();
  const router = useRouter();
  const stop = useStop(city.id, stopId);
  const refreshMs = cfg.departuresRefreshSeconds * 1000;
  const board = useBoard(city.id, stopId, refreshMs, cfg.features.board);
  const boardMissing = !cfg.features.board || !!board.error; // v1 API or no times → legacy departures
  const deps = useDepartures(city.id, stopId, refreshMs, boardMissing);
  const alerts = useAlerts(city.id, { stopId });
  const nearby = useNearbyStops(city.id, stop.data ? { lat: stop.data.lat, lon: stop.data.lon } : null, 400);
  const [showPois, setShowPois] = useState(false);
  const [routesOpen, setRoutesOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const s = stop.data;

  const others = useMemo(() => (nearby.data?.stops ?? []).filter((x) => x.id !== stopId), [nearby.data, stopId]);
  const mapStops: Stop[] = useMemo(() => (s ? [s, ...others] : []), [s, others]);

  // Legacy fallback (v1 API): a station has no stop times of its own → read the platforms.
  const platformIds = useMemo(() => {
    if (!boardMissing || !s || s.locationType !== "station" || !isNotFound(deps.error)) return [];
    const declared = s.children.map((c) => c.id);
    if (declared.length) return declared.slice(0, 6);
    return others.filter((o) => o.locationType === "stop" && o.distanceMeters <= 80).slice(0, 6).map((o) => o.id);
  }, [boardMissing, s, deps.error, others]);
  const platformDeps = useDeparturesMulti(city.id, platformIds, refreshMs);
  const legacy = deps.data
    ? { departures: deps.data.departures, generatedAt: deps.data.generatedAt, isFetching: deps.isFetching, isLoading: deps.isLoading }
    : platformIds.length
      ? platformDeps
      : { departures: [], generatedAt: null, isFetching: false, isLoading: deps.isLoading };

  // Vehicles heading here, tinted by ETA from the board rows (vehicleId → minutes)
  const routeIds = useMemo(() => new Set((s?.routes ?? []).map((r) => r.id)), [s]);
  const stream = useVehicleStream(city.id, cfg.features.liveVehicles && routeIds.size > 0);
  const rawVehicles = useMemo(() => [...stream.vehicles.values()].filter((v) => v.routeId && routeIds.has(v.routeId)), [stream.vehicles, routeIds]);
  const vehicles = useInterpolatedVehicles(rawVehicles, { cap: 300 });
  const etaById = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of board.data?.rows ?? []) for (const n of row.next) if (n.vehicleId) m.set(n.vehicleId, n.minutes);
    return m;
  }, [board.data]);
  const compColors = useMemo(() => Object.fromEntries(componentsOf(city).map((c) => [c.id, c.color])), [city]);

  const q = (kind: "from" | "to") => (s ? `?${kind}=${s.lat.toFixed(5)},${s.lon.toFixed(5)}&${kind}Name=${encodeURIComponent(s.name)}&view=plan` : "");
  const comp = componentOf(city, stopComponent(s));
  const routesDedup = useMemo(() => {
    const seen = new Map<string, StopDetail["routes"][number]>();
    for (const r of s?.routes ?? []) if (!seen.has(r.shortName)) seen.set(r.shortName, r);
    return [...seen.values()];
  }, [s]);
  const access = s ? (s.accessibility ?? { wheelchair: s.wheelchair, source: s.wheelchair === "unknown" ? "none" : "gtfs", verified: false, note: null }) : null;
  const accessLabel = !access ? null : access.wheelchair === "accessible" ? t.access.accessible : access.wheelchair === "not_accessible" ? t.access.notAccessible : t.access.unknown;

  const panel = (
    <div className="flex flex-col gap-4 p-4">
      {stop.isLoading ? <Spinner /> : null}
      {stop.error ? <EmptyState title={t.common.error} hint={(stop.error as Error).message} /> : null}
      {s ? (
        <>
          {/* header */}
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white" style={{ background: comp.color }}>
              <ComponentIcon icon={comp.icon} width={20} height={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-3">
                {s.locationType === "station" ? t.stop.station : s.locationType === "entrance" ? t.stop.entrance : t.stop.stop}
                {s.code ? ` · ${t.stop.code} ${s.code}` : ""} · {comp.label}
              </p>
              <h1 className="text-xl font-extrabold leading-tight tracking-tight">{s.name}</h1>
              {s.parentStation ? (
                <p className="mt-1 text-sm text-ink-2">
                  {t.stop.partOf}{" "}
                  <Link className="font-semibold text-signal" href={`/${city.id}/stops/${encodeURIComponent(s.parentStation.id)}`}>
                    {s.parentStation.name}
                  </Link>
                </p>
              ) : null}
            </div>
            {cfg.features.favorites ? <FavoriteButton city={city.id} item={{ kind: "stop", id: s.id, stopId: s.id, name: s.name, component: s.component }} /> : null}
          </div>

          {alerts.data?.alerts.slice(0, 2).map((a) => (
            <AlertCard key={a.id} alert={a} tz={city.timezone} compact city={city.id} links={city.links} />
          ))}

          {/* 1 · arrival board first */}
          <section aria-labelledby="board-title">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 id="board-title" className="text-sm font-bold">
                {boardMissing ? t.stop.departures : t.board.title}
              </h2>
              {cfg.features.next && routesDedup.length ? (
                <Link href={`/${city.id}/next?stop=${encodeURIComponent(s.id)}`} className="inline-flex h-10 items-center gap-1 text-xs font-semibold text-signal">
                  <Icon.Bus width={14} height={14} /> {t.next.title} →
                </Link>
              ) : null}
            </div>
            {!boardMissing ? (
              board.isLoading ? (
                <Spinner />
              ) : board.data ? (
                <ArrivalBoard board={board.data} city={city.id} refreshing={board.isFetching} onPickRoute={cfg.features.next ? (rid) => router.push(`/${city.id}/next?stop=${encodeURIComponent(s.id)}&route=${encodeURIComponent(rid)}`) : undefined} />
              ) : null
            ) : legacy.isLoading ? (
              <Spinner />
            ) : (
              <DeparturesBoard departures={legacy.departures} tz={city.timezone} city={city.id} generatedAt={legacy.generatedAt} refreshing={legacy.isFetching} />
            )}
            {city.features.tripUpdates ? <p className="mt-2 text-[11px] text-ink-3">{t.stop.liveOnly}</p> : null}
          </section>

          {/* 2 · plan from / to (+ taxi / app to get here) */}
          <div className="flex gap-2">
            <LinkButton href={`/${city.id}${q("from")}`} variant="primary" size="md" className="h-11 flex-1">
              {t.stop.planFrom}
            </LinkButton>
            <LinkButton href={`/${city.id}${q("to")}`} size="md" className="h-11 flex-1">
              {t.stop.planTo}
            </LinkButton>
          </div>
          {onDemandEnabled(city) ? (
            <Link href={`/${city.id}${q("to")}&taxi=1`} className="inline-flex h-10 items-center gap-1.5 self-start text-sm font-semibold text-signal" title={t.ondemand.atStopHint} data-testid="stop-taxi">
              <Icon.Car width={16} height={16} /> {t.ondemand.atStop} →
            </Link>
          ) : null}

          {/* 3 · routes, collapsed */}
          {routesDedup.length ? (
            <section>
              <button type="button" onClick={() => setRoutesOpen((o) => !o)} aria-expanded={routesOpen} className="flex h-11 w-full items-center justify-between text-sm font-bold">
                <span>{t.stop.routesCount(routesDedup.length)}</span>
                <Icon.Chevron width={16} height={16} className={`text-ink-3 transition-transform ${routesOpen ? "rotate-90" : ""}`} />
              </button>
              {routesOpen ? (
                <div className="flex flex-wrap gap-1.5">
                  {routesDedup.map((r) => (
                    <Link key={r.id} href={`/${city.id}/routes/${encodeURIComponent(r.id)}`} title={r.longName} className="inline-flex min-h-11 items-center">
                      <RouteChip route={r} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5" aria-hidden>
                  {routesDedup.slice(0, 8).map((r) => (
                    <RouteChip key={r.id} route={r} size="sm" />
                  ))}
                  {routesDedup.length > 8 ? <span className="text-xs text-ink-3">+{routesDedup.length - 8}</span> : null}
                </div>
              )}
            </section>
          ) : null}

          {/* 4 · accessibility, one muted line */}
          {access && accessLabel ? (
            <p className="flex items-center gap-2 text-xs text-ink-3" title={access.wheelchair !== "unknown" && !access.verified ? t.access.unverifiedHint : undefined}>
              <Icon.Wheelchair width={16} height={16} />
              <span>
                {accessLabel}
                {access.wheelchair !== "unknown" ? ` · ${access.verified ? t.access.verifiedBy(access.source === "osm" ? t.access.osm : t.access.gtfs) : t.access.unverified}` : ""}
              </span>
            </p>
          ) : null}

          {/* 5 · everything else, folded */}
          <section>
            <button type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} className="flex h-11 w-full items-center justify-between text-sm font-bold">
              <span>{t.stop.more}</span>
              <Icon.Chevron width={16} height={16} className={`text-ink-3 transition-transform ${moreOpen ? "rotate-90" : ""}`} />
            </button>
            {moreOpen ? (
              <div className="flex flex-col gap-4">
                {alerts.data && alerts.data.alerts.length > 2 ? alerts.data.alerts.slice(2).map((a) => <AlertCard key={a.id} alert={a} tz={city.timezone} compact city={city.id} links={city.links} />) : null}
                {s.children.length ? (
                  <div>
                    <h3 className="mb-1 text-xs font-semibold text-ink-2">{t.stop.platforms}</h3>
                    <ul className="flex flex-col gap-1 text-sm">
                      {s.children.map((c) => (
                        <li key={c.id}>
                          <Link className="inline-flex min-h-9 items-center hover:underline" href={`/${city.id}/stops/${encodeURIComponent(c.id)}`}>
                            {c.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {others.length ? (
                  <div>
                    <h3 className="mb-1 text-xs font-semibold text-ink-2">{t.stop.nearby}</h3>
                    <ul className="divide-y divide-line rounded-card border border-line">
                      {others.slice(0, 8).map((o) => (
                        <li key={o.id}>
                          <Link href={`/${city.id}/stops/${encodeURIComponent(o.id)}`} className="flex min-h-11 items-center justify-between px-3 py-2 text-sm hover:bg-paper-3">
                            <span className="truncate font-semibold">{o.name}</span>
                            <span className="shrink-0 tabular-nums text-ink-3">{Math.round(o.distanceMeters)} m</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <QrPanel path={`/${city.id}/stops/${encodeURIComponent(s.id)}`} title={s.name} />
                <PqrsLink city={city} compact />
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );

  return (
    <SplitLayout
      mode="strip"
      stripLabels={{ expand: t.stop.viewOnMap, collapse: t.stop.viewDetails }}
      panel={panel}
      map={
        <MapView center={[s?.lon ?? city.center.lon, s?.lat ?? city.center.lat]} zoom={s ? 15 : city.defaultZoom} attribution={city.attribution} className="h-full w-full">
          <StopsLayer stops={mapStops} onClick={(x) => router.push(`/${city.id}/stops/${encodeURIComponent(x.id)}`)} />
          {s ? <Center lat={s.lat} lon={s.lon} /> : null}
          {vehicles.length ? <VehiclesLayer vehicles={vehicles} etaById={etaById.size ? etaById : null} colors={compColors} focus onClick={(v) => router.push(`/${city.id}/live?vehicle=${encodeURIComponent(v.id)}`)} /> : null}
          {etaById.size ? <EtaLegend labels={{ title: t.live.legend, now: t.live.bucketNow, soon: t.live.bucketSoon, later: t.live.bucketLater, far: t.live.bucketFar }} className="hidden md:block" /> : null}
          {cfg.features.pois ? <PoisInView city={city.id} enabled={showPois} /> : null}
          {cfg.features.pois ? <MapToggle on={showPois} onClick={() => setShowPois((v) => !v)} label={showPois ? t.pois.hide : t.pois.show} icon={<Icon.Services width={18} height={18} />} /> : null}
        </MapView>
      }
    />
  );
}

function PoisInView({ city, enabled }: { city: string; enabled: boolean }) {
  const bbox = useMapBounds();
  const pois = usePois(city, bbox ? bbox.join(",") : null, enabled);
  return enabled ? <PoisLayer pois={pois.data} /> : null;
}

function Center({ lat, lon }: { lat: number; lon: number }) {
  useFitBounds([lon, lat, lon, lat]);
  return null;
}
