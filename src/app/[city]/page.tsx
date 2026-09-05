"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useCityCtx } from "@/components/shell/CityContext";
import { SplitLayout, type Snap } from "@/components/shell/SplitLayout";
import { MapView, useFitBounds, useMap, useMapZoom } from "@/components/map/MapView";
import { ItineraryLayer, LayersControl, LocateButton, NetworkLayer, PinMarker, PoisLayer, RENTAL_MIN_ZOOM, RentalStationsLayer, StopsLayer, VehiclesLayer, ZoomGate, useMapBounds } from "@/components/map/layers";
import { RentalStationCard } from "@/components/rental/RentalStationCard";
import { PlannerForm } from "@/components/planner/PlannerForm";
import { SortChips } from "@/components/planner/SortChips";
import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import { ItineraryDetail } from "@/components/itinerary/ItineraryDetail";
import { Hub } from "@/components/hub/Hub";
import { EmptyState, Icon, Spinner } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n/provider";
import { useNearbyStops, useNetwork, usePlan, usePois, useRentalStations } from "@/lib/api/hooks";
import { bikeShareEnabled, bikeShareNetworks, rentalModesFor } from "@/lib/rental";
import { api, ApiRequestError } from "@/lib/api/client";
import { useVehicleStream } from "@/lib/api/stream";
import { useInterpolatedVehicles } from "@/lib/interpolate";
import { useGeolocation } from "@/lib/use-geolocation";
import { useFavorites } from "@/lib/favorites";
import { resolveConfig, componentsOf } from "@/lib/city-config";
import { LIVE_MIN_ZOOM, liveAutoOn } from "@/lib/marker-style";
import { sortItineraries, type SortKey } from "@/lib/sort";
import { readPlanner, toPlanParams, writePlanner, type PlannerState } from "@/lib/planner-params";
import type { Itinerary, RentalStation } from "@/lib/api/types";

/** Keeps origin and destination in view while the person compares options. */
function FitPoints({ a, b }: { a: { lat: number; lon: number }; b: { lat: number; lon: number } }) {
  const small = typeof window !== "undefined" && window.innerWidth < 768;
  useFitBounds(
    [Math.min(a.lon, b.lon), Math.min(a.lat, b.lat), Math.max(a.lon, b.lon), Math.max(a.lat, b.lat)],
    small ? { top: 80, bottom: Math.round((typeof window !== "undefined" ? window.innerHeight : 800) * 0.55) + 20, left: 40, right: 40 } : { top: 80, bottom: 60, left: 470, right: 60 },
  );
  return null;
}

/** POI layer bound to the current viewport (needs the map context, hence its own component). */
function PoisInView({ city, enabled }: { city: string; enabled: boolean }) {
  const bbox = useMapBounds();
  const pois = usePois(city, bbox ? bbox.join(",") : null, enabled);
  return enabled ? <PoisLayer pois={pois.data} /> : null;
}

/** `?lat=&lon=&zoom=` → ease the camera there once (hub cards, deep links from other apps). */
function FocusOnParams({ lat, lon, zoom }: { lat: number | null; lon: number | null; zoom: number | null }) {
  const { map } = useMap();
  useEffect(() => {
    if (!map || lat == null || lon == null) return;
    map.easeTo({ center: [lon, lat], zoom: zoom ?? Math.max(map.getZoom(), 16), duration: 600 });
  }, [map, lat, lon, zoom]);
  return null;
}

/** Shared-bike stations in the viewport at street zoom (UX audit: hidden below 14, labels from 15). */
function RentalInView({ city, enabled, selectedId, onSelect }: { city: string; enabled: boolean; selectedId: string | null; onSelect: (s: RentalStation) => void }) {
  const cityObj = useCityCtx();
  const zoom = useMapZoom();
  const on = enabled && zoom >= RENTAL_MIN_ZOOM;
  const bbox = useMapBounds(250);
  const q = useRentalStations(city, bbox ? bbox.join(",") : null, on);
  return on && q.data ? <RentalStationsLayer stations={q.data.stations} networks={bikeShareNetworks(cityObj)} selectedId={selectedId} onClick={onSelect} /> : null;
}

/** Live vehicles for the selected itinerary (focus context: always drawn, any zoom). */
function LiveOnItinerary({ city, itinerary, enabled, onCount, colors }: { city: string; itinerary: Itinerary | null; enabled: boolean; onCount: (n: number) => void; colors: Record<string, string> }) {
  const routeIds = useMemo(() => new Set(itinerary?.legs.map((l) => l.route?.id).filter(Boolean) as string[]), [itinerary]);
  const stream = useVehicleStream(city, enabled && routeIds.size > 0);
  const raw = useMemo(() => (routeIds.size ? [...stream.vehicles.values()].filter((v) => v.routeId && routeIds.has(v.routeId)) : []), [stream.vehicles, routeIds]);
  const bbox = useMapBounds();
  const vehicles = useInterpolatedVehicles(raw, { bbox, cap: 300 });
  useEffect(() => onCount(raw.length), [raw.length, onCount]);
  return vehicles.length ? <VehiclesLayer vehicles={vehicles} colors={colors} focus /> : null;
}

/** The whole fleet, only inside the viewport and only at street zoom (UX audit B). */
function FleetInView({ city, enabled, colors, onClick }: { city: string; enabled: boolean; colors: Record<string, string>; onClick: (id: string) => void }) {
  const zoom = useMapZoom();
  const on = enabled && liveAutoOn(zoom);
  const stream = useVehicleStream(city, on);
  const bbox = useMapBounds(200);
  const inView = useMemo(() => {
    if (!on || !bbox) return [];
    const pad = 0.01;
    return [...stream.vehicles.values()].filter((v) => v.lon >= bbox[0] - pad && v.lon <= bbox[2] + pad && v.lat >= bbox[1] - pad && v.lat <= bbox[3] + pad);
  }, [stream.vehicles, bbox, on]);
  const vehicles = useInterpolatedVehicles(inView, { bbox, cap: 400 });
  return on && vehicles.length ? <VehiclesLayer vehicles={vehicles} colors={colors} onClick={(v) => onClick(v.id)} /> : null;
}

function NetworkInView({ city, trunk, zonal }: { city: string; trunk: boolean; zonal: boolean }) {
  const net = useNetwork(city, trunk || zonal);
  if (!net.data) return null;
  return (
    <>
      {zonal ? <NetworkLayer shapes={net.data.shapes} group="zonal" /> : null}
      {trunk ? <NetworkLayer shapes={net.data.shapes} group="trunk" /> : null}
    </>
  );
}

/** Layer popover + locate button, rendered inside the map so they can read the zoom. */
function MapControls({ city, live, setLive, pois, setPois, net, setNet, zonal, setZonal, bikes, setBikes, onLocate, locating }: { city: string; live: boolean; setLive: (v: boolean) => void; pois: boolean; setPois: (v: boolean) => void; net: boolean; setNet: (v: boolean) => void; zonal: boolean; setZonal: (v: boolean) => void; bikes: boolean; setBikes: (v: boolean) => void; onLocate: () => Promise<{ lat: number; lon: number } | null>; locating: boolean }) {
  const { t } = useI18n();
  const cityObj = useCityCtx();
  const cityCfg = resolveConfig(cityObj);
  const zoom = useMapZoom();
  const networks = bikeShareNetworks(cityObj);
  const items = [
    ...(cityCfg.features.liveVehicles ? [{ key: "live", label: t.layers.live, on: live, onChange: setLive, hint: liveAutoOn(zoom) ? t.layers.liveHint : t.layers.liveZoomHint }] : []),
    ...(bikeShareEnabled(cityObj) ? [{ key: "bikes", label: t.rental.layer, on: bikes, onChange: setBikes, hint: zoom >= RENTAL_MIN_ZOOM ? t.rental.layerHint(networks.map((n) => n.name).join(" · ")) : t.rental.layerZoomHint }] : []),
    { key: "network", label: t.layers.networkTrunk, on: net, onChange: setNet, hint: t.layers.networkTrunkHint },
    { key: "zonal", label: t.layers.networkZonal, on: zonal, onChange: setZonal, hint: t.layers.networkZonalHint },
    ...(cityCfg.features.pois ? [{ key: "pois", label: t.layers.pois, on: pois, onChange: setPois, hint: t.layers.poisHint }] : []),
  ];
  return (
    <>
      <LayersControl items={items} label={t.layers.title} slot={1} />
      <LocateButton onLocate={onLocate} busy={locating} label={t.layers.locate} slot={0} />
      <span className="sr-only">{city}</span>
    </>
  );
}

export default function PlannerPage() {
  return (
    <Suspense fallback={null}>
      <Planner />
    </Suspense>
  );
}

function Planner() {
  const city = useCityCtx();
  const cfg = resolveConfig(city);
  const { t, lang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const fav = useFavorites(city.id);

  const urlState = useMemo(() => readPlanner(new URLSearchParams(sp.toString())), [sp]);
  const view = sp.get("view");
  const focus = useMemo(() => {
    const lat = Number(sp.get("lat")), lon = Number(sp.get("lon")), z = Number(sp.get("zoom"));
    return sp.get("lat") && sp.get("lon") && Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon, zoom: Number.isFinite(z) && z > 0 ? z : null } : null;
  }, [sp]);
  const [draft, setDraft] = useState<PlannerState>(urlState);
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const [locating, setLocating] = useState<"from" | "to" | "hub" | null>(null);
  const [snap, setSnap] = useState<Snap>("peek");
  const [sort, setSort] = useState<SortKey>("default");
  const [showPois, setShowPois] = useState(false);
  const [showLive, setShowLive] = useState(true);
  const [showNet, setShowNet] = useState(true);
  const [showZonal, setShowZonal] = useState(false);
  const [showBikes, setShowBikes] = useState(true);
  const [bikeStation, setBikeStation] = useState<RentalStation | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const rentalModes = useMemo(() => rentalModesFor(bikeShareNetworks(city)), [city]);
  const geo = useGeolocation();

  // URL → draft (back/forward, shared links)
  useEffect(() => {
    setDraft(urlState);
  }, [urlState]);

  const commit = useCallback(
    (s: PlannerState, extra?: Record<string, string>) => {
      const p = writePlanner(s);
      for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const showHub = !urlState.from && !urlState.to && view !== "plan";
  const planParams = useMemo(() => toPlanParams(urlState, lang, rentalModes), [urlState, lang, rentalModes]);
  const plan = usePlan(city.id, planParams);
  const itineraries = useMemo(() => sortItineraries(plan.data?.itineraries ?? [], sort, city.fares), [plan.data, sort, city.fares]);
  const selected = urlState.selected !== null ? ((plan.data?.itineraries ?? [])[urlState.selected] ?? null) : null;

  // Sheet position follows the task: hub peeks, the form needs room, results/detail share the map.
  const stage = showHub ? "hub" : selected ? "detail" : planParams ? "results" : "form";
  useEffect(() => {
    setSnap(stage === "hub" ? "peek" : stage === "form" ? "full" : "half");
  }, [stage]);

  // remember every completed plan as a recent trip (local only)
  useEffect(() => {
    if (plan.data && urlState.from && urlState.to && plan.data.itineraries.length) fav.addRecent(urlState.from, urlState.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.data?.itineraries]);

  const nearby = useNearbyStops(city.id, geo.pos, 700);

  const locateFor = async (kind: "from" | "to" | "hub") => {
    setLocating(kind);
    const pos = await geo.locate();
    setLocating(null);
    if (!pos || kind === "hub") return pos;
    let name: string = t.planner.myLocation;
    try {
      name = (await api.reverse(city.id, pos.lat, pos.lon)).name;
    } catch {
      /* keep generic name */
    }
    const next = { ...draft, [kind]: { ...pos, name }, selected: null };
    setDraft(next);
    if (next.from && next.to) commit(next);
    return pos;
  };

  const onMapClick = async (ll: { lng: number; lat: number }) => {
    if (!picking) return;
    const kind = picking;
    setPicking(null);
    let name = `${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)}`;
    try {
      name = (await api.reverse(city.id, ll.lat, ll.lng)).name;
    } catch {
      /* fallback to coords */
    }
    const next = { ...draft, [kind]: { lat: ll.lat, lon: ll.lng, name }, selected: null };
    setDraft(next);
    setSnap("full");
    if (next.from && next.to) commit(next);
  };

  const openPlanner = () => commit(draft, { view: "plan" });
  const planWithPlace = async (p: { lat: number; lon: number; name: string }, kind: "to" | "from") => {
    // "Ir a casa": destination is the place; origin is the device if we can get it
    const next: PlannerState = { ...draft, [kind]: p, selected: null };
    if (kind === "to" && !next.from) {
      const pos = await geo.locate();
      if (pos) {
        let name: string = t.planner.myLocation;
        try {
          name = (await api.reverse(city.id, pos.lat, pos.lon)).name;
        } catch {
          /* generic */
        }
        next.from = { ...pos, name };
      }
    }
    setDraft(next);
    commit(next, { view: "plan" });
  };

  const routerDown = plan.error instanceof ApiRequestError && plan.error.status >= 500;
  const onCount = useCallback((n: number) => setLiveCount(n), []);
  const compColors = useMemo(() => Object.fromEntries(componentsOf(city).map((c) => [c.id, c.color])), [city]);

  const panel = showHub ? (
    <Hub city={city} onPlan={openPlanner} onLocate={() => locateFor("hub")} pos={geo.pos} locating={locating === "hub"} onUsePlace={planWithPlace} expanded={snap !== "peek"} />
  ) : (
    <div className="flex flex-col">
      {selected || stage === "results" ? (
        /* Compact summary while reading results or an itinerary; tap to edit. */
        <button type="button" onClick={() => commit({ ...urlState, selected: null }, { view: "plan" })} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper-3" aria-label={t.planner.editTrip}>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
            <span className="truncate font-semibold">
              <span className="mr-1.5 inline-grid h-4 w-4 place-items-center rounded-full bg-ink text-[9px] font-extrabold text-paper">A</span>
              {draft.from?.name}
            </span>
            <span className="truncate font-semibold">
              <span className="mr-1.5 inline-grid h-4 w-4 place-items-center rounded-full bg-signal text-[9px] font-extrabold text-signal-ink">B</span>
              {draft.to?.name}
            </span>
          </span>
          <span className="shrink-0 text-xs font-semibold text-signal">{t.planner.editTrip}</span>
        </button>
      ) : (
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-xl font-extrabold tracking-tight">{t.planner.title}</h1>
            <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="inline-flex h-10 items-center gap-1 text-xs font-semibold text-ink-3 hover:text-ink">
              <Icon.Back width={14} height={14} /> {t.nav.home}
            </button>
          </div>
          <PlannerForm
            city={city}
            state={draft}
            onChange={setDraft}
            onSubmit={() => commit({ ...draft, selected: null })}
            onUseLocation={locateFor}
            onPickOnMap={(k) => {
              setPicking(k);
              setSnap("peek");
            }}
            picking={picking}
            locating={locating === "from" || locating === "to" ? locating : null}
            userPos={geo.pos}
            compact={!!selected}
            bikeEnabled={cfg.features.bike}
          />
          {geo.error ? <p className="mt-2 text-xs text-brick">{t.planner.locationDenied}</p> : null}
          {picking ? <p className="mt-2 rounded-md bg-amber/30 px-2 py-1 text-xs font-semibold">{t.planner.pickOnMapHint}</p> : null}
          {fav.recents.length ? (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-ink-2">{t.favorites.recents}</p>
              <ul className="flex flex-col gap-1">
                {fav.recents.slice(0, 3).map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => commit({ ...draft, from: r.from, to: r.to, selected: null })} className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-line bg-paper-2 px-3 py-2 text-left text-sm hover:border-ink">
                      <Icon.Clock width={14} height={14} className="shrink-0 text-ink-3" />
                      <span className="truncate">
                        {r.from.name ?? "…"} → {r.to.name ?? "…"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {stage !== "form" ? <div className="border-t border-line" /> : null}

      {selected ? (
        <ItineraryDetail itinerary={selected} city={city} liveCount={liveCount} endpoints={{ from: draft.from?.name, to: draft.to?.name }} onBack={() => commit({ ...urlState, selected: null })} />
      ) : stage === "results" ? (
        <div className="flex flex-col gap-3 p-4">
          {plan.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-ink-2">
              <Spinner /> {t.planner.loading}
            </div>
          ) : routerDown ? (
            <EmptyState title={t.planner.routerDown} hint={t.planner.routerDownHint} icon={<Icon.Alert />} />
          ) : plan.error ? (
            <EmptyState
              title={t.common.error}
              hint={(plan.error as Error).message}
              action={
                <button type="button" className="text-sm font-semibold text-signal" onClick={() => plan.refetch()}>
                  {t.common.retry}
                </button>
              }
            />
          ) : itineraries.length === 0 ? (
            <EmptyState title={t.planner.noResults} hint={t.planner.noResultsHint} />
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-ink-2">{t.planner.results}</h2>
                {plan.data?.router.realtime ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
                    <span className="live-dot" /> {t.planner.realtime}
                  </span>
                ) : null}
              </div>
              <SortChips value={sort} onChange={setSort} hasFares={!!city.fares} />
              {itineraries.map((it) => {
                const i = (plan.data?.itineraries ?? []).indexOf(it);
                return <ItineraryCard key={it.id} index={i} itinerary={it} tz={city.timezone} selected={false} fares={city.fares} onSelect={() => commit({ ...urlState, selected: i })} />;
              })}
              {plan.data?.warnings.map((w) => (
                <p key={w} className="text-xs text-ink-3">
                  {w}
                </p>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );

  // Phone-only floating search pill (desktop has it inside the panel)
  const overlay = showHub ? (
    <button type="button" onClick={openPlanner} className="absolute left-3 right-3 top-[60px] z-10 flex h-12 items-center gap-3 rounded-2xl border border-line bg-paper-2/95 px-4 text-left text-[15px] text-ink-3 shadow-card backdrop-blur" aria-label={t.hub.searchPlaceholder}>
      <Icon.Search className="text-ink-2" />
      <span className="flex-1 truncate">{t.hub.searchPlaceholder}</span>
    </button>
  ) : null;

  return (
    <SplitLayout
      snap={snap}
      onSnapChange={setSnap}
      overlay={overlay}
      panel={panel}
      map={
        <MapView center={[city.center.lon, city.center.lat]} zoom={city.defaultZoom} attribution={city.attribution} onClick={onMapClick} className={`h-full w-full ${picking ? "cursor-crosshair" : ""}`}>
          <ZoomGate min={12} force={false}>
            <NetworkInView city={city.id} trunk={showNet && !selected} zonal={showZonal && !selected} />
          </ZoomGate>
          {!selected && nearby.data ? <StopsLayer stops={nearby.data.stops} onClick={(s) => router.push(`/${city.id}/stops/${encodeURIComponent(s.id)}`)} /> : null}
          <ItineraryLayer itinerary={selected} />
          {focus && !selected ? <FocusOnParams lat={focus.lat} lon={focus.lon} zoom={focus.zoom} /> : null}
          {!selected && draft.from && draft.to ? <FitPoints a={draft.from} b={draft.to} /> : null}
          {cfg.features.liveVehicles && selected ? <LiveOnItinerary city={city.id} itinerary={selected} enabled colors={compColors} onCount={onCount} /> : null}
          {cfg.features.liveVehicles && !selected ? <FleetInView city={city.id} enabled={showLive} colors={compColors} onClick={(id) => router.push(`/${city.id}/live?vehicle=${encodeURIComponent(id)}`)} /> : null}
          {cfg.features.pois ? <PoisInView city={city.id} enabled={showPois} /> : null}
          {bikeShareEnabled(city) && !selected ? <RentalInView city={city.id} enabled={showBikes} selectedId={bikeStation?.id ?? null} onSelect={setBikeStation} /> : null}
          {draft.from ? <PinMarker kind="from" lat={draft.from.lat} lon={draft.from.lon} /> : null}
          {draft.to ? <PinMarker kind="to" lat={draft.to.lat} lon={draft.to.lon} /> : null}
          {geo.pos ? <PinMarker kind="user" lat={geo.pos.lat} lon={geo.pos.lon} /> : null}
          <MapControls city={city.id} live={showLive} setLive={setShowLive} pois={showPois} setPois={setShowPois} net={showNet} setNet={setShowNet} zonal={showZonal} setZonal={setShowZonal} bikes={showBikes} setBikes={setShowBikes} onLocate={() => locateFor("hub")} locating={locating === "hub"} />
          {bikeStation && !selected ? (
            <RentalStationCard
              city={city}
              station={bikeStation}
              onClose={() => setBikeStation(null)}
              onDirections={(st) => {
                setBikeStation(null);
                planWithPlace({ lat: st.lat, lon: st.lon, name: st.name }, "to");
              }}
              onPlanFrom={(st) => {
                setBikeStation(null);
                planWithPlace({ lat: st.lat, lon: st.lon, name: st.name }, "from");
              }}
            />
          ) : null}
          <span className="sr-only">{LIVE_MIN_ZOOM}</span>
        </MapView>
      }
    />
  );
}
