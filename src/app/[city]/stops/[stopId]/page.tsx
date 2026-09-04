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
import { Badge, EmptyState, Icon, LinkButton, Spinner } from "@/components/ui/primitives";
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
import type { Stop, StopDetail } from "@/lib/api/types";

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

  const panel = (
    <div className="flex flex-col gap-4 p-4">
      {stop.isLoading ? <Spinner /> : null}
      {stop.error ? <EmptyState title={t.common.error} hint={(stop.error as Error).message} /> : null}
      {s ? (
        <>
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

          <div className="flex gap-2">
            <LinkButton href={`/${city.id}${q("from")}`} variant="primary" size="sm" className="flex-1">
              {t.stop.planFrom}
            </LinkButton>
            <LinkButton href={`/${city.id}${q("to")}`} size="sm" className="flex-1">
              {t.stop.planTo}
            </LinkButton>
          </div>

          {alerts.data?.alerts.map((a) => (
            <AlertCard key={a.id} alert={a} tz={city.timezone} compact city={city.id} links={city.links} />
          ))}

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-ink-2">{boardMissing ? t.stop.departures : t.board.title}</h2>
              {cfg.features.next && routesDedup.length ? (
                <Link href={`/${city.id}/next?stop=${encodeURIComponent(s.id)}`} className="text-xs font-semibold text-signal">
                  {t.next.title} →
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
            {city.features.tripUpdates ? <p className="mt-2 text-xs text-ink-3">{t.stop.liveOnly}</p> : null}
          </section>

          {routesDedup.length ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-ink-2">{t.stop.routes}</h2>
              <div className="flex flex-wrap gap-1.5">
                {routesDedup.map((r) => (
                  <Link key={r.id} href={`/${city.id}/routes/${encodeURIComponent(r.id)}`} title={r.longName}>
                    <RouteChip route={r} />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <AccessibilityBlock stop={s} />

          {s.children.length ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-ink-2">{t.stop.platforms}</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {s.children.map((c) => (
                  <li key={c.id}>
                    <Link className="hover:underline" href={`/${city.id}/stops/${encodeURIComponent(c.id)}`}>
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {others.length ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-ink-2">{t.stop.nearby}</h2>
              <ul className="divide-y divide-line rounded-card border border-line">
                {others.slice(0, 8).map((o) => (
                  <li key={o.id}>
                    <Link href={`/${city.id}/stops/${encodeURIComponent(o.id)}`} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-paper-3">
                      <span className="truncate font-semibold">{o.name}</span>
                      <span className="shrink-0 tabular-nums text-ink-3">{Math.round(o.distanceMeters)} m</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <QrPanel path={`/${city.id}/stops/${encodeURIComponent(s.id)}`} title={s.name} />
          <PqrsLink city={city} compact />
        </>
      ) : null}
    </div>
  );

  return (
    <SplitLayout
      panel={panel}
      map={
        <MapView center={[s?.lon ?? city.center.lon, s?.lat ?? city.center.lat]} zoom={s ? 15 : city.defaultZoom} attribution={city.attribution} className="h-full w-full">
          <StopsLayer stops={mapStops} onClick={(x) => router.push(`/${city.id}/stops/${encodeURIComponent(x.id)}`)} />
          {s ? <Center lat={s.lat} lon={s.lon} /> : null}
          {vehicles.length ? <VehiclesLayer vehicles={vehicles} etaById={etaById.size ? etaById : null} colors={compColors} onClick={(v) => router.push(`/${city.id}/live?vehicle=${encodeURIComponent(v.id)}`)} /> : null}
          {etaById.size ? <EtaLegend labels={{ title: t.live.legend, now: t.live.bucketNow, soon: t.live.bucketSoon, later: t.live.bucketLater, far: t.live.bucketFar }} /> : null}
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

/** Honest accessibility: says when the feed value is a blanket default. */
function AccessibilityBlock({ stop }: { stop: StopDetail }) {
  const { t } = useI18n();
  const a = stop.accessibility ?? { wheelchair: stop.wheelchair, source: stop.wheelchair === "unknown" ? "none" : "gtfs", verified: false, note: null };
  const label = a.wheelchair === "accessible" ? t.access.accessible : a.wheelchair === "not_accessible" ? t.access.notAccessible : t.access.unknown;
  const tone = a.wheelchair === "unknown" ? "neutral" : a.verified ? (a.wheelchair === "accessible" ? "ok" : "bad") : "warn";
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-ink-2">{t.access.title}</h2>
      <div className="rounded-card border border-line bg-paper-2 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Icon.Wheelchair width={18} height={18} className="text-ink-2" />
          <span className="font-semibold">{label}</span>
          {a.wheelchair !== "unknown" ? <Badge tone={tone}>{a.verified ? t.access.verifiedBy(a.source === "osm" ? t.access.osm : t.access.gtfs) : t.access.unverified}</Badge> : null}
        </div>
        {a.wheelchair !== "unknown" && !a.verified ? <p className="mt-1.5 text-xs text-ink-3">{t.access.unverifiedHint}</p> : null}
      </div>
    </section>
  );
}

function Center({ lat, lon }: { lat: number; lon: number }) {
  useFitBounds([lon, lat, lon, lat]);
  return null;
}
