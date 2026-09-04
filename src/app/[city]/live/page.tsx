"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useCityCtx } from "@/components/shell/CityContext";
import { SplitLayout } from "@/components/shell/SplitLayout";
import { MapView } from "@/components/map/MapView";
import { EtaLegend, LineLayer, MapToggle, PoisLayer, StopsLayer, VehiclesLayer, useMapBounds } from "@/components/map/layers";
import { VehiclePanel } from "@/components/vehicles/VehiclePanel";
import { ComponentIcon } from "@/components/ui/ComponentIcon";
import { FreshnessBadge } from "@/components/ui/FreshnessBadge";
import { useI18n } from "@/lib/i18n/provider";
import { useBoard, usePois, useStop, useVehicle } from "@/lib/api/hooks";
import { useVehicleStream } from "@/lib/api/stream";
import { useInterpolatedVehicles } from "@/lib/interpolate";
import { freshnessFromAge } from "@/lib/freshness";
import { resolveConfig, componentsOf } from "@/lib/city-config";
import { Icon, inputCls } from "@/components/ui/primitives";
import type { Component, Vehicle } from "@/lib/api/types";

export default function LivePage() {
  return (
    <Suspense fallback={null}>
      <Live />
    </Suspense>
  );
}

function Live() {
  const city = useCityCtx();
  const cfg = resolveConfig(city);
  const { t } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const [component, setComponent] = useState<Component | "">((sp.get("component") as Component) ?? "");
  const [routeQ, setRouteQ] = useState(sp.get("route") ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(sp.get("vehicle"));
  const [showPois, setShowPois] = useState(false);
  const stopId = sp.get("stop"); // "buses hacia esta parada": tint by ETA
  const stream = useVehicleStream(city.id, cfg.features.liveVehicles);
  const selectedDetail = useVehicle(city.id, selectedId);
  const stop = useStop(city.id, stopId ?? "");
  const board = useBoard(city.id, stopId ?? "", cfg.departuresRefreshSeconds * 1000, !!stopId && cfg.features.board);

  const comps = componentsOf(city);
  const compColors = useMemo(() => Object.fromEntries(comps.map((c) => [c.id, c.color])), [comps]);
  const stopRoutes = useMemo(() => new Set((stop.data?.routes ?? []).map((r) => r.id)), [stop.data]);
  const etaById = useMemo(() => {
    if (!stopId) return null;
    const m = new Map<string, number>();
    for (const row of board.data?.rows ?? []) for (const n of row.next) if (n.vehicleId) m.set(n.vehicleId, n.minutes);
    return m;
  }, [board.data, stopId]);

  const vehicles = useMemo(() => {
    const q = routeQ.trim().toUpperCase();
    return [...stream.vehicles.values()].filter(
      (v) =>
        (!component || v.component === component) &&
        (!q || (v.routeShortName ?? "").toUpperCase().startsWith(q)) &&
        (!stopId || !stopRoutes.size || (v.routeId && stopRoutes.has(v.routeId))),
    );
  }, [stream.vehicles, component, routeQ, stopId, stopRoutes]);

  const status = stream.status === "live" ? t.live.live : stream.status === "reconnecting" ? t.live.reconnecting : t.live.connecting;
  const fresh = freshnessFromAge(stream.health?.entityAgeP50Seconds);

  const panel = selectedId ? (
    <VehiclePanel city={city} id={selectedId} onClose={() => setSelectedId(null)} />
  ) : (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">{t.live.title}</h1>
        <p className="mt-1 text-sm text-ink-2">{t.live.hint}</p>
      </div>

      {stopId && stop.data ? (
        <div className="flex items-center gap-2 rounded-card border border-line bg-paper p-3 text-sm">
          <Icon.Pin className="shrink-0 text-ink-2" />
          <span className="min-w-0 flex-1 truncate">
            {t.live.forStop} <Link href={`/${city.id}/stops/${encodeURIComponent(stopId)}`} className="font-semibold hover:underline">{stop.data.name}</Link>
          </span>
          <button type="button" onClick={() => router.replace(`/${city.id}/live`, { scroll: false })} className="shrink-0 text-xs font-semibold text-signal">
            {t.common.close}
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-card border border-line bg-paper p-3">
        <div>
          <p className="text-2xl font-extrabold tabular-nums tracking-tight">{vehicles.length.toLocaleString()}</p>
          <p className="text-xs text-ink-3">{t.live.vehicles(stream.vehicles.size)}</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right text-xs text-ink-2">
          <p className="inline-flex items-center gap-1.5 font-semibold text-ink">
            <span className={`live-dot ${stream.status !== "live" ? "opacity-40" : ""}`} /> {status}
          </p>
          <FreshnessBadge freshness={fresh} realtime={stream.status === "live" && !fresh.stale} />
          {stream.health?.pctTripResolved != null ? (
            <p>
              {stream.health.pctTripResolved.toFixed(0)}% {t.live.resolved}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-ink-2">{t.live.filter}</p>
        <div className="flex flex-wrap gap-1.5">
          <Chip on={component === ""} onClick={() => setComponent("")} color="var(--ink)">
            {t.live.all}
          </Chip>
          {comps.map((c) => (
            <Chip key={c.id} on={component === c.id} onClick={() => setComponent(component === c.id ? "" : c.id)} color={c.color} icon={<ComponentIcon icon={c.icon} width={14} height={14} />}>
              {c.label}
            </Chip>
          ))}
        </div>
        <label className="block">
          <span className="sr-only">{t.live.route}</span>
          <input className={inputCls} placeholder={t.live.routePlaceholder} value={routeQ} onChange={(e) => setRouteQ(e.target.value)} />
        </label>
      </div>
    </div>
  );

  return (
    <SplitLayout
      panel={panel}
      map={
        <MapView center={[city.center.lon, city.center.lat]} zoom={city.defaultZoom} attribution={city.attribution} className="h-full w-full">
          {selectedDetail.data?.shape ? <LineLayer id="vehicle-shape" geometry={selectedDetail.data.shape} color={compColors[selectedDetail.data.component] ?? "#667085"} width={3} /> : null}
          {stop.data ? <StopsLayer stops={[stop.data]} /> : null}
          <Fleet
            vehicles={vehicles}
            colors={compColors}
            etaById={etaById}
            selectedId={selectedId}
            onClick={(v) => {
              setSelectedId(v.id);
              const p = new URLSearchParams(sp.toString());
              p.set("vehicle", v.id);
              router.replace(`/${city.id}/live?${p.toString()}`, { scroll: false });
            }}
          />
          {etaById?.size ? <EtaLegend labels={{ title: t.live.legend, now: t.live.bucketNow, soon: t.live.bucketSoon, later: t.live.bucketLater, far: t.live.bucketFar }} /> : null}
          {cfg.features.pois ? <PoisInView city={city.id} enabled={showPois} /> : null}
          {cfg.features.pois ? <MapToggle on={showPois} onClick={() => setShowPois((v) => !v)} label={showPois ? t.pois.hide : t.pois.show} icon={<Icon.Services width={18} height={18} />} /> : null}
        </MapView>
      }
    />
  );
}

/** Interpolates only what is in the viewport (cap 500), the rest renders static. */
function Fleet({ vehicles, colors, etaById, selectedId, onClick }: { vehicles: Vehicle[]; colors: Record<string, string>; etaById: Map<string, number> | null; selectedId: string | null; onClick: (v: Vehicle) => void }) {
  const bbox = useMapBounds();
  const animated = useInterpolatedVehicles(vehicles, { bbox, cap: 500 });
  return <VehiclesLayer vehicles={animated} colors={colors} etaById={etaById} dimOthers={!!etaById} selectedId={selectedId} onClick={onClick} />;
}

function PoisInView({ city, enabled }: { city: string; enabled: boolean }) {
  const bbox = useMapBounds();
  const pois = usePois(city, bbox ? bbox.join(",") : null, enabled);
  return enabled ? <PoisLayer pois={pois.data} /> : null;
}

function Chip({ on, onClick, color, icon, children }: { on: boolean; onClick: () => void; color: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${on ? "border-transparent text-white" : "border-line bg-paper-2 text-ink-2 hover:border-line-2"}`}
      style={on ? { background: color, color: color === "var(--ink)" ? "var(--paper)" : "#fff" } : undefined}
    >
      {icon ? <span style={on ? undefined : { color }}>{icon}</span> : !on ? <span className="h-2 w-2 rounded-full" style={{ background: color }} /> : null}
      {children}
    </button>
  );
}
