"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCityCtx } from "@/components/shell/CityContext";
import { SplitLayout, type Snap } from "@/components/shell/SplitLayout";
import { MapView, useFitBounds, useMap, useMapZoom } from "@/components/map/MapView";
import { ItineraryLayer, LayersControl, LocateButton, NETWORK_GROUPS, NetworkLayer, PinMarker, PoisLayer, RENTAL_MIN_ZOOM, RentalStationsLayer, StopsLayer, VehiclesLayer, ZoomGate, useMapBounds } from "@/components/map/layers";
import { RentalStationCard } from "@/components/rental/RentalStationCard";
import { PlannerForm } from "@/components/planner/PlannerForm";
import { MapPicker } from "@/components/planner/MapPicker";
import { LongPressPick } from "@/components/planner/LongPressPick";
import { ResultsList } from "@/components/itinerary/ResultsList";
import { DepartureForecast } from "@/components/planner/DepartureForecast";
import { ItineraryDetail } from "@/components/itinerary/ItineraryDetail";
import { Hub } from "@/components/hub/Hub";
import { ChatSheet } from "@/components/assistant/ChatSheet";
import { EmptyState, Icon, Spinner } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n/provider";
import { useNearbyStops, useNetwork, usePlan, usePois, useRentalStations } from "@/lib/api/hooks";
import { bikeShareEnabled, bikeShareNetworks, rentalModesFor } from "@/lib/rental";
import { api, ApiRequestError } from "@/lib/api/client";
import { useVehicleStream } from "@/lib/api/stream";
import { useInterpolatedVehicles } from "@/lib/interpolate";
import { useGeolocation } from "@/lib/use-geolocation";
import { useOnline } from "@/lib/use-online";
import { assistantEnabled } from "@/lib/assistant";
import { useFavorites } from "@/lib/favorites";
import { resolveConfig, componentsOf, networkLayerLabel } from "@/lib/city-config";
import { LIVE_MIN_ZOOM, liveAutoOn } from "@/lib/marker-style";
import { track, useScreenView } from "@/lib/analytics";
import { readPlanner, toPlanParams, writePlanner, type PlannerPoint, type PlannerState } from "@/lib/planner-params";
import { applyEndpoint, otherField, pointFrom, swapEndpoints, type Field } from "@/lib/place-choice";
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
  const trunkLabel = cityObj ? networkLayerLabel(cityObj, NETWORK_GROUPS.trunk.components) : null;
  const zonalLabel = cityObj ? networkLayerLabel(cityObj, NETWORK_GROUPS.zonal.components) : null;
  const items = [
    ...(cityCfg.features.liveVehicles ? [{ key: "live", label: t.layers.live, on: live, onChange: setLive, hint: liveAutoOn(zoom) ? t.layers.liveHint : t.layers.liveZoomHint }] : []),
    ...(bikeShareEnabled(cityObj) ? [{ key: "bikes", label: t.rental.layer, on: bikes, onChange: setBikes, hint: zoom >= RENTAL_MIN_ZOOM ? t.rental.layerHint(networks.map((n) => n.name).join(" · ")) : t.rental.layerZoomHint }] : []),
    // Named by the city's own components ("Troncal · TransMiCable", "Subway · Streetcar"), and dropped
    // when the city has nothing in that group, so no toggle draws an empty layer.
    ...(trunkLabel ? [{ key: "network", label: trunkLabel, on: net, onChange: setNet, hint: t.layers.networkTrunkHint }] : []),
    ...(zonalLabel ? [{ key: "zonal", label: zonalLabel, on: zonal, onChange: setZonal, hint: t.layers.networkZonalHint }] : []),
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
  const [showPois, setShowPois] = useState(false);
  const [showLive, setShowLive] = useState(true);
  const [showNet, setShowNet] = useState(true);
  const [showZonal, setShowZonal] = useState(false);
  const [showBikes, setShowBikes] = useState(true);
  const [bikeStation, setBikeStation] = useState<RentalStation | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [forecast, setForecast] = useState(false);
  const [chat, setChat] = useState(false);
  const rentalModes = useMemo(() => rentalModesFor(bikeShareNetworks(city)), [city]);
  const geo = useGeolocation();

  // URL → draft (back/forward, shared links)
  useEffect(() => {
    setDraft(urlState);
  }, [urlState]);
  useEffect(() => setForecast(false), [urlState.from?.lat, urlState.from?.lon, urlState.to?.lat, urlState.to?.lon]);

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
  const itineraries = useMemo(() => plan.data?.itineraries ?? [], [plan.data]);
  const selected = urlState.selected !== null ? ((plan.data?.itineraries ?? [])[urlState.selected] ?? null) : null;
  useScreenView(city.id, showHub ? "home" : selected ? "itinerary" : planParams ? "results" : "planner");

  // analytics: what people ask for and what they get (coarse coordinates, no free text)
  useEffect(() => {
    if (!planParams) return;
    track("plan_request", {
      fromLat: planParams.fromLat, fromLon: planParams.fromLon, toLat: planParams.toLat, toLon: planParams.toLon,
      fromKind: urlState.from?.name === t.planner.myLocation ? "myLocation" : "place", toKind: "place",
      modes: planParams.modes ?? [], timeType: planParams.time ? (planParams.arriveBy ? "arrive" : "depart") : "now",
      wheelchair: !!planParams.wheelchair, rental: urlState.rental, onDemand: !!planParams.onDemand, bike: urlState.bike,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planParams]);
  useEffect(() => {
    if (!plan.data || !planParams) return;
    const its = plan.data.itineraries;
    const best = its[0];
    track("plan_result", { count: its.length, bestDurationSeconds: best?.durationSeconds ?? null, bestTransfers: best?.transfers ?? null, hasRental: its.some((i) => i.rentalLegs), hasOnDemand: its.some((i) => i.source === "ondemand") });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.data]);
  useEffect(() => {
    if (plan.error) track("error", { code: plan.error instanceof ApiRequestError ? plan.error.code : "PLAN_FAILED", screen: "results" });
  }, [plan.error]);
  useEffect(() => {
    if (!selected || urlState.selected === null) return;
    track("itinerary_select", { index: urlState.selected, source: selected.source ?? "primary", modes: selected.modesUsed ?? [], durationSeconds: selected.durationSeconds, transfers: selected.transfers, fareAmount: selected.fare?.amount ?? null, routeIds: selected.legs.map((l) => l.route?.id).filter((x): x is string => !!x) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // Sheet position follows the task: hub peeks, the form needs room, results/detail share the map.
  // `view=plan` on a trip that already has both ends means "let me edit it": without this the
  // fields, the swap and the map picks became unreachable as soon as a plan existed.
  const stage = showHub ? "hub" : selected ? "detail" : view === "plan" ? "form" : planParams ? "results" : "form";
  useEffect(() => {
    setSnap(stage === "hub" ? "peek" : stage === "form" ? "full" : "half");
  }, [stage]);

  // remember every completed plan as a recent trip (local only)
  useEffect(() => {
    if (plan.data && urlState.from && urlState.to && plan.data.itineraries.length) fav.addRecent(urlState.from, urlState.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.data?.itineraries]);

  const nearby = useNearbyStops(city.id, geo.pos, 700);
  // layer toggles feed the mobility analytics (which layers people actually use)
  const toggleTracked = (layer: string, set: (v: boolean) => void) => (v: boolean) => {
    set(v);
    track("layer_toggle", { layer, on: v });
  };

  /**
   * v2.1 — one way in for every source (typing, the map, the device): fill a field and,
   * once both ends are set, run the plan. Nothing else may write `from`/`to`.
   */
  const applyPlace = useCallback(
    (field: Field, p: PlannerPoint) => {
      const { next, ready } = applyEndpoint(draft, field, p);
      setDraft(next);
      if (ready) commit(next);
    },
    [draft, commit],
  );
  // async callers (reverse geocoding a dropped pin) must not write through a stale draft
  const applyRef = useRef(applyPlace);
  applyRef.current = applyPlace;

  /** Exchanging the ends is valid with one of them empty; re-plan only when both survive. */
  const swap = useCallback(() => {
    const next = swapEndpoints(draft);
    setDraft(next);
    if (next.from && next.to) commit(next);
  }, [draft, commit]);

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
    applyPlace(kind, { ...pos, name });
    return pos;
  };

  /**
   * A pin dropped on the itinerary map re-plans from where it landed straight away
   * (labelled with its coordinates), then re-labels itself once the name comes back.
   */
  const onDropPin = async (field: Field, p: { lat: number; lon: number }) => {
    applyPlace(field, pointFrom(p.lat, p.lon));
    try {
      const { name } = await api.reverse(city.id, p.lat, p.lon);
      if (name?.trim()) applyRef.current(field, pointFrom(p.lat, p.lon, name));
    } catch {
      /* the coordinates stand as the label */
    }
  };

  const openPlanner = () => commit(draft, { view: "plan" });
  /** Lote 2 B1 — the commute card hands over a whole trip; plan it straight away. */
  const planTrip = (patch: Partial<PlannerState>) => {
    const next: PlannerState = { ...draft, ...patch, selected: null };
    setDraft(next);
    if (next.from && next.to) commit(next);
    else commit(next, { view: "plan" });
  };
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

  // The assistant answers through the API, so it is hidden offline and when the city turned it off.
  const online = useOnline();
  const canAsk = assistantEnabled(city, online);
  const openChat = useCallback(() => setChat(true), []);
  const closeChat = useCallback(() => setChat(false), []);

  const routerDown = plan.error instanceof ApiRequestError && plan.error.status >= 500;
  const onCount = useCallback((n: number) => setLiveCount(n), []);
  const compColors = useMemo(() => Object.fromEntries(componentsOf(city).map((c) => [c.id, c.color])), [city]);

  const panel = showHub ? (
    <Hub city={city} onPlan={openPlanner} onLocate={() => locateFor("hub")} pos={geo.pos} locating={locating === "hub"} onUsePlace={planWithPlace} onPlanTrip={planTrip} expanded={snap !== "peek"} onAsk={canAsk ? openChat : undefined} />
  ) : (
    <div className="flex flex-col">
      {stage === "results" || stage === "detail" ? (
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
            onPlace={applyPlace}
            onSwap={swap}
            onUseLocation={locateFor}
            onPickOnMap={setPicking}
            picking={picking}
            locating={locating === "from" || locating === "to" ? locating : null}
            userPos={geo.pos}
            compact={!!selected}
            bikeEnabled={cfg.features.bike}
          />
          {geo.error ? <p className="mt-2 text-xs text-brick">{t.planner.locationDenied}</p> : null}
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
              {forecast && urlState.from && urlState.to ? (
                <DepartureForecast
                  city={city}
                  from={urlState.from}
                  to={urlState.to}
                  modes={planParams?.modes}
                  onClose={() => setForecast(false)}
                  onPick={(departAt) => {
                    setForecast(false);
                    commit({ ...urlState, time: departAt, arriveBy: false, selected: null });
                  }}
                />
              ) : null}
              <ResultsList itineraries={itineraries} all={plan.data?.itineraries ?? []} tz={city.timezone} fares={city.fares} realtime={!!plan.data?.router.realtime} onSelect={(i) => commit({ ...urlState, selected: i })} onRefresh={() => plan.refetch()} onForecast={() => setForecast((v) => !v)} />
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
    <div className="absolute left-3 right-3 top-[60px] z-10 flex gap-2">
      <button type="button" onClick={openPlanner} className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-line bg-paper-2/95 px-4 text-left text-[15px] text-ink-3 shadow-card backdrop-blur" aria-label={t.hub.searchPlaceholder}>
        <Icon.Search className="text-ink-2" />
        <span className="flex-1 truncate">{t.hub.searchPlaceholder}</span>
      </button>
      {canAsk ? (
        <button type="button" onClick={openChat} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-line bg-paper-2/95 text-signal shadow-card backdrop-blur" aria-label={t.assistant.entry} title={t.assistant.entry} data-testid="assistant-open-overlay">
          <Icon.Chat width={20} height={20} />
        </button>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      {canAsk ? <ChatSheet city={city} open={chat} onClose={closeChat} pos={geo.pos} /> : null}
      {picking ? (
        <MapPicker
          city={city}
          field={picking}
          initial={draft[picking] ?? draft[otherField(picking)] ?? geo.pos ?? city.center}
          onCancel={() => setPicking(null)}
          onConfirm={(p) => {
            setPicking(null);
            applyPlace(picking, p);
          }}
          onLocate={() => locateFor("hub")}
          locating={locating === "hub"}
        />
      ) : null}
      <SplitLayout
      snap={snap}
      onSnapChange={setSnap}
      overlay={overlay}
      panel={panel}
      map={
        <MapView center={[city.center.lon, city.center.lat]} zoom={city.defaultZoom} attribution={city.attribution} className="h-full w-full">
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
          {/* v2.1 — the two ends are draggable: dropping one re-plans from where it landed */}
          {draft.from ? <PinMarker kind="from" lat={draft.from.lat} lon={draft.from.lon} label={t.planner.pinFrom} draggable onDragEnd={(p) => onDropPin("from", p)} /> : null}
          {draft.to ? <PinMarker kind="to" lat={draft.to.lat} lon={draft.to.lon} label={t.planner.pinTo} draggable onDragEnd={(p) => onDropPin("to", p)} /> : null}
          {geo.pos ? <PinMarker kind="user" lat={geo.pos.lat} lon={geo.pos.lon} /> : null}
          {/* v2.1 — pressing a spot on the map is the second way to start or end a trip there */}
          <LongPressPick onPick={onDropPin} />
          <MapControls city={city.id} live={showLive} setLive={toggleTracked("live", setShowLive)} pois={showPois} setPois={toggleTracked("pois", setShowPois)} net={showNet} setNet={toggleTracked("network", setShowNet)} zonal={showZonal} setZonal={toggleTracked("zonal", setShowZonal)} bikes={showBikes} setBikes={toggleTracked("bikes", setShowBikes)} onLocate={() => locateFor("hub")} locating={locating === "hub"} />
          {bikeStation && !selected ? (
            <RentalStationCard
              city={city}
              station={bikeStation}
              onClose={() => setBikeStation(null)}
              onDirections={(st) => {
                track("rental_station_view", { stationId: st.id, networkId: st.networkId });
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
    </>
  );
}
