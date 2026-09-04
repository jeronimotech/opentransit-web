"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { useCityCtx } from "@/components/shell/CityContext";
import { SplitLayout } from "@/components/shell/SplitLayout";
import { MapView, useFitBounds } from "@/components/map/MapView";
import { StopsLayer } from "@/components/map/layers";
import { DeparturesBoard } from "@/components/stops/DeparturesBoard";
import { AlertCard } from "@/components/alerts/AlertCard";
import { Badge, EmptyState, Icon, LinkButton, Spinner } from "@/components/ui/primitives";
import { RouteChip } from "@/components/ui/RouteChip";
import { isNotFound, useAlerts, useDepartures, useDeparturesMulti, useNearbyStops, useStop } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n/provider";
import { useRouter } from "next/navigation";
import type { Stop } from "@/lib/api/types";

export default function StopPage({ params }: { params: Promise<{ stopId: string }> }) {
  const { stopId: raw } = use(params);
  const stopId = decodeURIComponent(raw);
  const city = useCityCtx();
  const { t } = useI18n();
  const router = useRouter();
  const stop = useStop(city.id, stopId);
  const deps = useDepartures(city.id, stopId);
  const alerts = useAlerts(city.id, { stopId });
  const nearby = useNearbyStops(city.id, stop.data ? { lat: stop.data.lat, lon: stop.data.lon } : null, 400);
  const s = stop.data;

  const others = useMemo(() => (nearby.data?.stops ?? []).filter((x) => x.id !== stopId), [nearby.data, stopId]);
  const mapStops: Stop[] = useMemo(() => (s ? [s, ...others] : []), [s, others]);

  // A station has no stop times of its own (the API answers 404): read the platforms instead,
  // either the declared children or, failing that, the plain stops within a few metres.
  const platformIds = useMemo(() => {
    if (!s || s.locationType !== "station" || !isNotFound(deps.error)) return [];
    const declared = s.children.map((c) => c.id);
    if (declared.length) return declared.slice(0, 6);
    return others.filter((o) => o.locationType === "stop" && o.distanceMeters <= 80).slice(0, 6).map((o) => o.id);
  }, [s, deps.error, others]);
  const platformDeps = useDeparturesMulti(city.id, platformIds);
  const board = deps.data
    ? { departures: deps.data.departures, generatedAt: deps.data.generatedAt, isFetching: deps.isFetching, isLoading: deps.isLoading }
    : platformIds.length
      ? platformDeps
      : { departures: [], generatedAt: null, isFetching: false, isLoading: deps.isLoading };

  const wheelchair =
    s?.wheelchair === "accessible" ? (
      <Badge tone="ok">
        <Icon.Wheelchair width={12} height={12} /> {t.stop.accessible}
      </Badge>
    ) : s?.wheelchair === "not_accessible" ? (
      <Badge tone="bad">{t.stop.notAccessible}</Badge>
    ) : (
      <Badge>{t.stop.unknownAccess}</Badge>
    );

  const q = (kind: "from" | "to") =>
    s ? `?${kind}=${s.lat.toFixed(5)},${s.lon.toFixed(5)}&${kind}Name=${encodeURIComponent(s.name)}` : "";

  const panel = (
    <div className="flex flex-col gap-4 p-4">
      {stop.isLoading ? <Spinner /> : null}
      {stop.error ? <EmptyState title={t.common.error} hint={(stop.error as Error).message} /> : null}
      {s ? (
        <>
          <div>
            <p className="text-xs text-ink-3">
              {s.locationType === "station" ? t.stop.station : s.locationType === "entrance" ? t.stop.entrance : t.stop.stop}
              {s.code ? ` · ${t.stop.code} ${s.code}` : ""}
            </p>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight">{s.name}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {s.component ? <Badge tone="neutral">{t.component[s.component]}</Badge> : null}
              {wheelchair}
            </div>
            {s.parentStation ? (
              <p className="mt-2 text-sm text-ink-2">
                {t.stop.partOf}{" "}
                <Link className="font-semibold text-signal" href={`/${city.id}/stops/${encodeURIComponent(s.parentStation.id)}`}>
                  {s.parentStation.name}
                </Link>
              </p>
            ) : null}
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
            <AlertCard key={a.id} alert={a} tz={city.timezone} compact />
          ))}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-ink-2">{t.stop.departures}</h2>
            {board.isLoading ? <Spinner /> : null}
            {!board.isLoading ? (
              <DeparturesBoard departures={board.departures} tz={city.timezone} city={city.id} generatedAt={board.generatedAt} refreshing={board.isFetching} />
            ) : null}
            {city.features.tripUpdates ? <p className="mt-2 text-xs text-ink-3">{t.stop.liveOnly}</p> : null}
          </section>

          {s.routes.length ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-ink-2">{t.stop.routes}</h2>
              <div className="flex flex-wrap gap-1.5">
                {s.routes.map((r) => (
                  <Link key={r.id} href={`/${city.id}/routes/${encodeURIComponent(r.id)}`} title={r.longName}>
                    <RouteChip route={r} />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

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
        </MapView>
      }
    />
  );
}

function Center({ lat, lon }: { lat: number; lon: number }) {
  useFitBounds([lon, lat, lon, lat]);
  return null;
}
