"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useCityCtx } from "@/components/shell/CityContext";
import { SplitLayout } from "@/components/shell/SplitLayout";
import { MapView } from "@/components/map/MapView";
import { EtaLegend, LineLayer, MapToggle, PinMarker, PoisLayer, StopsLayer, VehiclesLayer, useMapBounds } from "@/components/map/layers";
import { RadiusCircle, useFollowCamera } from "@/components/map/NearMeLayers";
import { NearbyList } from "@/components/live/NearbyList";
import { VehiclePanel } from "@/components/vehicles/VehiclePanel";
import { ComponentIcon } from "@/components/ui/ComponentIcon";
import { FreshnessBadge } from "@/components/ui/FreshnessBadge";
import { useI18n } from "@/lib/i18n/provider";
import { useScreenView, track } from "@/lib/analytics";
import { useBoard, usePois, useStop, useVehicle } from "@/lib/api/hooks";
import { useVehicleStream } from "@/lib/api/stream";
import { useInterpolatedVehicles } from "@/lib/interpolate";
import { freshnessFromAge } from "@/lib/freshness";
import { resolveConfig, componentsOf } from "@/lib/city-config";
import { useWatchPosition } from "@/lib/use-geolocation";
import { RADII, bboxForRadius, bboxParam, nearbyVehicles, readPrefs, writePrefs, type Radius } from "@/lib/near-me";
import { Icon, inputCls } from "@/components/ui/primitives";
import type { Component, LatLon, Vehicle } from "@/lib/api/types";

export default function LivePage() {
  return (
    <Suspense fallback={null}>
      <Live />
    </Suspense>
  );
}

function Live() {
  const city = useCityCtx();
  useScreenView(city.id, "live");
  const cfg = resolveConfig(city);
  const { t } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const nearMode = sp.get("near") === "me";

  const [component, setComponent] = useState<Component | "">((sp.get("component") as Component) ?? "");
  const [routeQ, setRouteQ] = useState(sp.get("route") ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(sp.get("vehicle"));
  const [showPois, setShowPois] = useState(false);
  const stopId = sp.get("stop"); // "buses hacia esta parada": tint by ETA

  // ── near-me state ─────────────────────────────────────────────────────────
  const [radius, setRadius] = useState<Radius>(600);
  const [nearComponents, setNearComponents] = useState<Component[]>([]);
  const [pickedPoint, setPickedPoint] = useState<LatLon | null>(null);
  const [picking, setPicking] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    const p = readPrefs(city.id);
    setRadius(p.radius);
    setNearComponents(p.components);
    setPrefsLoaded(true);
  }, [city.id]);
  useEffect(() => {
    if (prefsLoaded) writePrefs(city.id, { radius, components: nearComponents });
  }, [city.id, radius, nearComponents, prefsLoaded]);

  const watch = useWatchPosition(nearMode && !pickedPoint);
  const center: LatLon | null = pickedPoint ?? watch.pos;
  const denied = nearMode && !pickedPoint && !!watch.error;

  // Snapped bbox: a walking user does not re-subscribe on every GPS fix, but a
  // radius change does. Only the near-me mode filters the stream server-side.
  const bbox = useMemo(() => (nearMode && center ? bboxParam(bboxForRadius(center, radius)) : null), [nearMode, center?.lat, center?.lon, radius]); // eslint-disable-line react-hooks/exhaustive-deps

  const streamFilters = useMemo(() => (bbox ? { bbox } : undefined), [bbox]);
  const stream = useVehicleStream(city.id, cfg.features.liveVehicles && (!nearMode || !!center), {
    filters: streamFilters,
    pauseWhenHidden: nearMode,
  });

  const selectedDetail = useVehicle(city.id, selectedId);
  const stop = useStop(city.id, stopId ?? "");
  const board = useBoard(city.id, stopId ?? "", cfg.departuresRefreshSeconds * 1000, !!stopId && cfg.features.board);

  const comps = componentsOf(city);
  const compColors = useMemo(() => Object.fromEntries(comps.map((c) => [c.id, c.color])), [comps]);
  const stopRoutes = useMemo(() => new Set((stop.data?.routes ?? []).map((r) => r.id)), [stop.data]);
  const etaById = useMemo(() => {
    if (!stopId || nearMode) return null;
    const m = new Map<string, number>();
    for (const row of board.data?.rows ?? []) for (const n of row.next) if (n.vehicleId) m.set(n.vehicleId, n.minutes);
    return m;
  }, [board.data, stopId, nearMode]);

  const fresh = freshnessFromAge(stream.health?.entityAgeP50Seconds);

  const nearSet = useMemo(() => new Set(nearComponents), [nearComponents]);
  const nearby = useMemo(
    () => (nearMode && center ? nearbyVehicles(stream.vehicles.values(), center, radius, nearSet) : []),
    [nearMode, center?.lat, center?.lon, radius, nearSet, stream.vehicles], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const vehicles = useMemo(() => {
    if (nearMode) return nearby.map((n) => n.vehicle);
    const q = routeQ.trim().toUpperCase();
    return [...stream.vehicles.values()].filter(
      (v) =>
        (!component || v.component === component) &&
        (!q || (v.routeShortName ?? "").toUpperCase().startsWith(q)) &&
        (!stopId || !stopRoutes.size || (v.routeId && stopRoutes.has(v.routeId))),
    );
  }, [nearMode, nearby, stream.vehicles, component, routeQ, stopId, stopRoutes]);

  const setParam = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(sp.toString());
      mutate(p);
      const q = p.toString();
      router.replace(`/${city.id}/live${q ? `?${q}` : ""}`, { scroll: false });
    },
    [sp, router, city.id],
  );

  const selectVehicle = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      setParam((p) => (id ? p.set("vehicle", id) : p.delete("vehicle")));
    },
    [setParam],
  );

  const toggleMode = useCallback(() => {
    const on = !nearMode;
    track("layer_toggle", { layer: "near_me", on });
    setSelectedId(null);
    setParam((p) => {
      p.delete("vehicle");
      if (on) p.set("near", "me");
      else p.delete("near");
    });
  }, [nearMode, setParam]);

  const status = stream.status === "live" ? t.live.live : stream.status === "reconnecting" ? t.live.reconnecting : t.live.connecting;

  const modeToggle = (
    <div className="flex rounded-full border border-line bg-paper-2 p-0.5" role="group" aria-label={t.nearMe.title} data-testid="nearme-toggle">
      <button
        type="button"
        aria-pressed={!nearMode}
        onClick={() => nearMode && toggleMode()}
        className={`h-8 flex-1 rounded-full px-3 text-xs font-semibold ${!nearMode ? "bg-ink text-paper" : "text-ink-2"}`}
      >
        {t.nearMe.off}
      </button>
      <button
        type="button"
        aria-pressed={nearMode}
        onClick={() => !nearMode && toggleMode()}
        className={`h-8 flex-1 rounded-full px-3 text-xs font-semibold ${nearMode ? "bg-ink text-paper" : "text-ink-2"}`}
      >
        {t.nearMe.on}
      </button>
    </div>
  );

  const nearPanel = (
    <div className="flex flex-col gap-4 p-4" data-testid="nearme-panel">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">{t.nearMe.title}</h1>
        <p className="mt-1 text-sm text-ink-2">{t.nearMe.subtitle}</p>
      </div>
      {modeToggle}

      {denied ? (
        <div className="flex flex-col items-start gap-2 rounded-card border border-line bg-paper p-3">
          <p className="text-sm font-semibold">{t.nearMe.denied}</p>
          <p className="text-xs text-ink-2">{t.nearMe.deniedHint}</p>
          <button type="button" onClick={() => setPicking(true)} className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-sm font-semibold text-paper">
            {t.nearMe.pickOnMap}
          </button>
        </div>
      ) : !center ? (
        <p className="text-sm text-ink-2">{t.nearMe.locating}</p>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-ink-2">{t.nearMe.radius}</p>
        <div className="flex gap-1.5">
          {RADII.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={radius === r}
              onClick={() => setRadius(r)}
              className={`h-8 flex-1 rounded-full border text-xs font-semibold ${radius === r ? "border-transparent bg-ink text-paper" : "border-line bg-paper-2 text-ink-2 hover:border-line-2"}`}
            >
              {t.nearMe.radiusValue(r)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {comps.map((c) => {
          const on = nearSet.has(c.id);
          return (
            <Chip
              key={c.id}
              on={on}
              color={c.color}
              icon={<ComponentIcon icon={c.icon} width={14} height={14} />}
              onClick={() => setNearComponents((prev) => (on ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
            >
              {c.label}
            </Chip>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{t.nearMe.count(nearby.length)}</p>
        <FreshnessBadge freshness={fresh} realtime={stream.status === "live" && !fresh.stale} />
      </div>
      {fresh.stale ? <p className="-mt-2 text-xs text-disruption">{t.nearMe.staleWarning}</p> : null}

      {center ? (
        <NearbyList items={nearby} radius={radius} selectedId={selectedId} onSelect={selectVehicle} onWiden={setRadius} stale={fresh.stale} />
      ) : null}

      {pickedPoint ? (
        <button type="button" onClick={() => { setPickedPoint(null); setPicking(false); }} className="self-start text-xs font-semibold text-signal">
          {t.nearMe.useMyLocation}
        </button>
      ) : null}
    </div>
  );

  const fleetPanel = (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">{t.live.title}</h1>
        <p className="mt-1 text-sm text-ink-2">{t.live.hint}</p>
      </div>
      {modeToggle}

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

  const panel = selectedId ? <VehiclePanel city={city} id={selectedId} onClose={() => selectVehicle(null)} /> : nearMode ? nearPanel : fleetPanel;

  return (
    <SplitLayout
      defaultSnap="peek"
      panel={panel}
      map={
        <MapView
          center={[city.center.lon, city.center.lat]}
          zoom={city.defaultZoom}
          attribution={city.attribution}
          className="h-full w-full"
          onClick={picking ? (ll) => { setPickedPoint({ lat: ll.lat, lon: ll.lng }); setPicking(false); } : undefined}
        >
          {selectedDetail.data?.shape ? <LineLayer id="vehicle-shape" geometry={selectedDetail.data.shape} color={compColors[selectedDetail.data.component] ?? "#667085"} width={3} /> : null}
          {stop.data && !nearMode ? <StopsLayer stops={[stop.data]} /> : null}
          {nearMode && center ? <RadiusCircle center={center} radiusM={radius} /> : null}
          {nearMode && center ? <PinMarker lat={center.lat} lon={center.lon} kind="user" /> : null}
          {nearMode ? <FollowCamera pos={center} label={t.nearMe.back} enabled={!pickedPoint} /> : null}
          <Fleet
            routeQ={routeQ.trim()}
            component={component}
            vehicles={vehicles}
            colors={compColors}
            etaById={etaById}
            selectedId={selectedId}
            focus={nearMode}
            onClick={(v) => selectVehicle(v.id)}
          />
          {etaById?.size ? <EtaLegend labels={{ title: t.live.legend, now: t.live.bucketNow, soon: t.live.bucketSoon, later: t.live.bucketLater, far: t.live.bucketFar }} /> : null}
          {picking ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
              <span className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold shadow-card">{t.nearMe.pickHint}</span>
            </div>
          ) : null}
          {cfg.features.pois && !nearMode ? <PoisInView city={city.id} enabled={showPois} /> : null}
          {cfg.features.pois && !nearMode ? <MapToggle on={showPois} onClick={() => setShowPois((v) => !v)} label={showPois ? t.pois.hide : t.pois.show} icon={<Icon.Services width={18} height={18} />} /> : null}
        </MapView>
      }
    />
  );
}

/**
 * Follow-me camera plus the pill that hands control back. Rendered inside MapView
 * so it can use the map context; the pill only appears once the user has panned.
 */
function FollowCamera({ pos, label, enabled }: { pos: LatLon | null; label: string; enabled: boolean }) {
  const { userMoved, resetUserMoved } = useFollowCamera(pos, enabled);
  if (!userMoved || !pos) return null;
  return (
    <div className="absolute inset-x-0 z-10 flex justify-center" style={{ bottom: "calc(var(--sheet-h, 0px) + 12px)" }}>
      <button
        type="button"
        onClick={resetUserMoved}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-semibold shadow-card"
      >
        <Icon.Locate width={16} height={16} />
        {label}
      </button>
    </div>
  );
}

/** Interpolates only what is in the viewport (cap 500), the rest renders static. */
function Fleet({ vehicles, colors, etaById, selectedId, onClick, routeQ, component, focus }: { vehicles: Vehicle[]; colors: Record<string, string>; etaById: Map<string, number> | null; selectedId: string | null; onClick: (v: Vehicle) => void; routeQ: string; component: string; focus?: boolean }) {
  const bbox = useMapBounds();
  const animated = useInterpolatedVehicles(vehicles, { bbox, cap: 500 });
  return <VehiclesLayer vehicles={animated} colors={colors} etaById={etaById} dimOthers={!!etaById} selectedId={selectedId} focus={focus || !!etaById || !!routeQ || !!component} onClick={onClick} />;
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
