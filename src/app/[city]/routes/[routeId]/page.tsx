"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useMemo, useState } from "react";
import { useCityCtx } from "@/components/shell/CityContext";
import { SplitLayout } from "@/components/shell/SplitLayout";
import { MapView } from "@/components/map/MapView";
import { LineLayer, StopsLayer, VehiclesLayer } from "@/components/map/layers";
import { AlertCard } from "@/components/alerts/AlertCard";
import { Badge, EmptyState, Spinner } from "@/components/ui/primitives";
import { RouteChip } from "@/components/ui/RouteChip";
import { useRoute } from "@/lib/api/hooks";
import { useVehicleStream } from "@/lib/api/stream";
import { useI18n } from "@/lib/i18n/provider";
import { componentColor } from "@/lib/colors";
import { normalizeHex } from "@/lib/geo";

export default function RoutePage({ params }: { params: Promise<{ routeId: string }> }) {
  const { routeId: raw } = use(params);
  const routeId = decodeURIComponent(raw);
  const city = useCityCtx();
  const { t } = useI18n();
  const router = useRouter();
  const { data: r, isLoading, error } = useRoute(city.id, routeId);
  const [dir, setDir] = useState(0);
  const pattern = r?.patterns[dir] ?? r?.patterns[0] ?? null;
  const color = r ? normalizeHex(r.color, componentColor(r.component)) : "#667085";

  const stream = useVehicleStream(city.id, city.features.realtimeVehicles);
  const vehicles = useMemo(() => [...stream.vehicles.values()].filter((v) => v.routeId === routeId), [stream.vehicles, routeId]);

  const panel = (
    <div className="flex flex-col gap-4 p-4">
      {isLoading ? <Spinner /> : null}
      {error ? <EmptyState title={t.common.error} hint={(error as Error).message} /> : null}
      {r ? (
        <>
          <div className="flex items-start gap-3">
            <RouteChip route={r} size="lg" />
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold leading-tight tracking-tight">{r.longName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
                <Badge>{t.component[r.component]}</Badge>
                <span>{t.mode[r.mode]}</span>
                {city.features.realtimeVehicles ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="live-dot" style={{ width: 6, height: 6 }} /> {t.route.liveVehicles(vehicles.length)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {r.alerts.length ? (
            <div className="flex flex-col gap-2">
              {r.alerts.map((a) => (
                <AlertCard key={a.id} alert={a} tz={city.timezone} compact />
              ))}
            </div>
          ) : null}

          {r.patterns.length > 1 ? (
            <div className="inline-flex rounded-lg bg-paper-3 p-0.5 text-sm font-semibold">
              {r.patterns.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDir(i)}
                  className={`min-w-0 flex-1 truncate rounded-md px-3 py-1.5 ${i === dir ? "bg-paper-2 text-ink shadow-sm" : "text-ink-2"}`}
                  aria-pressed={i === dir}
                >
                  {t.planner.towards} {p.headsign ?? p.stops[p.stops.length - 1]?.name ?? `${i + 1}`}
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
          {vehicles.length ? <VehiclesLayer vehicles={vehicles} onClick={(v) => router.push(`/${city.id}/live?vehicle=${encodeURIComponent(v.id)}`)} /> : null}
        </MapView>
      }
    />
  );
}
