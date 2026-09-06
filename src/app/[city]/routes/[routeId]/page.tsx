"use client";

import { cleanHeadsign } from "@/lib/text";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useMemo, useState, useEffect } from "react";
import { useCityCtx } from "@/components/shell/CityContext";
import { SplitLayout } from "@/components/shell/SplitLayout";
import { MapView } from "@/components/map/MapView";
import { LineLayer, StopsLayer, VehiclesLayer, useMapBounds } from "@/components/map/layers";
import { AlertCard } from "@/components/alerts/AlertCard";
import { Badge, EmptyState, Spinner } from "@/components/ui/primitives";
import { RouteChip } from "@/components/ui/RouteChip";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { QrPanel } from "@/components/ui/QrPanel";
import { PqrsLink } from "@/components/ui/AgencyLinks";
import { ComponentIcon } from "@/components/ui/ComponentIcon";
import { useRoute } from "@/lib/api/hooks";
import { useVehicleStream } from "@/lib/api/stream";
import { useInterpolatedVehicles } from "@/lib/interpolate";
import { useI18n } from "@/lib/i18n/provider";
import { track, useScreenView } from "@/lib/analytics";
import { routeChipColors } from "@/lib/route-color";
import { resolveConfig, componentOf, componentsOf } from "@/lib/city-config";
import { serviceStatus } from "@/lib/service-window";
import type { Vehicle } from "@/lib/api/types";

export default function RoutePage({ params }: { params: Promise<{ routeId: string }> }) {
  const { routeId: rawId } = use(params);
  const routeId = decodeURIComponent(rawId);
  const city = useCityCtx();
  const cfg = resolveConfig(city);
  const { t } = useI18n();
  const router = useRouter();
  const { data: r, isLoading, error } = useRoute(city.id, routeId);
  useScreenView(city.id, "route");
  useEffect(() => {
    if (r) track("route_view", { routeId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.id]);
  const [dir, setDir] = useState(0);
  const pattern = r?.patterns[dir] ?? r?.patterns[0] ?? null;
  const comp = componentOf(city, r?.component);
  const color = r ? routeChipColors(r.color, comp.color).bg : "#667085";
  const svc = serviceStatus(t, r);

  const stream = useVehicleStream(city.id, cfg.features.liveVehicles);
  const raw = useMemo(() => [...stream.vehicles.values()].filter((v) => v.routeId === routeId), [stream.vehicles, routeId]);
  const compColors = useMemo(() => Object.fromEntries(componentsOf(city).map((c) => [c.id, c.color])), [city]);

  const panel = (
    <div className="flex flex-col gap-4 p-4">
      {isLoading ? <Spinner /> : null}
      {error ? <EmptyState title={t.common.error} hint={(error as Error).message} /> : null}
      {r ? (
        <>
          <div className="flex items-start gap-3">
            <RouteChip route={r} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-extrabold leading-tight tracking-tight">{cleanHeadsign(r.longName)}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
                <Badge>
                  <ComponentIcon icon={comp.icon} width={12} height={12} /> {comp.label}
                </Badge>
                <span>{t.mode[r.mode]}</span>
                {cfg.features.liveVehicles ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="live-dot" style={{ width: 6, height: 6 }} /> {t.route.liveVehicles(raw.length)}
                  </span>
                ) : null}
              </div>
              {svc.label ? <p className={`mt-1.5 text-sm ${svc.active ? "text-moss" : "font-semibold text-brick"}`}>{svc.label}</p> : null}
            </div>
            {cfg.features.favorites ? (
              <FavoriteButton city={city.id} item={{ kind: "route", id: r.id, routeId: r.id, shortName: r.shortName, longName: r.longName, color: color, component: r.component }} />
            ) : null}
          </div>

          {r.alerts.length ? (
            <div className="flex flex-col gap-2">
              {r.alerts.map((a) => (
                <AlertCard key={a.id} alert={a} tz={city.timezone} compact city={city.id} links={city.links} />
              ))}
            </div>
          ) : null}

          {r.patterns.length > 1 ? (
            <div className="inline-flex rounded-lg bg-paper-3 p-0.5 text-sm font-semibold">
              {r.patterns.map((p, i) => (
                <button key={p.id} type="button" onClick={() => setDir(i)} className={`min-w-0 flex-1 truncate rounded-md px-3 py-1.5 ${i === dir ? "bg-paper-2 text-ink shadow-sm" : "text-ink-2"}`} aria-pressed={i === dir}>
                  {t.planner.towards} {cleanHeadsign(p.headsign) ?? p.stops[p.stops.length - 1]?.name ?? `${i + 1}`}
                </button>
              ))}
            </div>
          ) : null}

          {pattern ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-ink-2">
                {t.route.stopsOn} · {t.planner.stops(pattern.stops.length)}
              </h2>
              <ol className="relative">
                {pattern.stops.map((s, i) => (
                  <li key={`${s.id}-${i}`} className="grid grid-cols-[20px_1fr] gap-x-2">
                    <div className="relative flex justify-center">
                      <span className="z-10 mt-1.5 h-3 w-3 rounded-full border-2 bg-paper-2" style={{ borderColor: color }} />
                      {i < pattern.stops.length - 1 ? <span className="absolute top-3 bottom-0 w-1" style={{ background: color }} /> : null}
                    </div>
                    <Link href={`/${city.id}/stops/${encodeURIComponent(s.id)}`} className="pb-3 text-sm font-semibold hover:underline">
                      {s.name}
                      {s.code ? <span className="ml-1.5 text-xs font-normal text-ink-3">{s.code}</span> : null}
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <QrPanel path={`/${city.id}/routes/${encodeURIComponent(r.id)}`} title={`${r.shortName} · ${r.longName}`} />
          <PqrsLink city={city} compact />
        </>
      ) : null}
    </div>
  );

  return (
    <SplitLayout
      panel={panel}
      map={
        <MapView center={[city.center.lon, city.center.lat]} zoom={city.defaultZoom} attribution={city.attribution} className="h-full w-full">
          {pattern ? <LineLayer id="pattern" geometry={pattern.geometry} color={color} width={5} fit /> : null}
          {pattern ? <StopsLayer stops={pattern.stops} onClick={(s) => router.push(`/${city.id}/stops/${encodeURIComponent(s.id)}`)} /> : null}
          <RouteVehicles vehicles={raw} colors={compColors} onClick={(v) => router.push(`/${city.id}/live?vehicle=${encodeURIComponent(v.id)}`)} />
        </MapView>
      }
    />
  );
}

function RouteVehicles({ vehicles, colors, onClick }: { vehicles: Vehicle[]; colors: Record<string, string>; onClick: (v: Vehicle) => void }) {
  const bbox = useMapBounds();
  const animated = useInterpolatedVehicles(vehicles, { bbox, cap: 300 });
  return animated.length ? <VehiclesLayer vehicles={animated} colors={colors} onClick={onClick} /> : null;
}
