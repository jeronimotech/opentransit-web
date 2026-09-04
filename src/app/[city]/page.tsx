"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useCityCtx } from "@/components/shell/CityContext";
import { SplitLayout } from "@/components/shell/SplitLayout";
import { MapView, useFitBounds } from "@/components/map/MapView";
import { ItineraryLayer, MapToggle, PinMarker, PoisLayer, StopsLayer, VehiclesLayer, useMapBounds } from "@/components/map/layers";
import { PlannerForm } from "@/components/planner/PlannerForm";
import { SortChips } from "@/components/planner/SortChips";
import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import { ItineraryDetail } from "@/components/itinerary/ItineraryDetail";
import { Hub } from "@/components/hub/Hub";
import { EmptyState, Icon, Spinner } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n/provider";
import { useNearbyStops, usePlan, usePois } from "@/lib/api/hooks";
import { api, ApiRequestError } from "@/lib/api/client";
import { useVehicleStream } from "@/lib/api/stream";
import { useInterpolatedVehicles } from "@/lib/interpolate";
import { useGeolocation } from "@/lib/use-geolocation";
import { useFavorites } from "@/lib/favorites";
import { resolveConfig, componentsOf } from "@/lib/city-config";
import { sortItineraries, type SortKey } from "@/lib/sort";
import { readPlanner, toPlanParams, writePlanner, type PlannerState } from "@/lib/planner-params";
import type { Itinerary } from "@/lib/api/types";

/** Keeps origin and destination in view while the person compares options. */
function FitPoints({ a, b }: { a: { lat: number; lon: number }; b: { lat: number; lon: number } }) {
  const small = typeof window !== "undefined" && window.innerWidth < 768;
  useFitBounds(
    [Math.min(a.lon, b.lon), Math.min(a.lat, b.lat), Math.max(a.lon, b.lon), Math.max(a.lat, b.lat)],
    small ? { top: 80, bottom: 320, left: 40, right: 40 } : { top: 80, bottom: 60, left: 470, right: 60 },
  );
  return null;
}

/** POI layer bound to the current viewport (needs the map context, hence its own component). */
function PoisInView({ city, enabled }: { city: string; enabled: boolean }) {
  const bbox = useMapBounds();
  const pois = usePois(city, bbox ? bbox.join(",") : null, enabled);
  return enabled ? <PoisLayer pois={pois.data} /> : null;
}

/** Live vehicles for the selected itinerary, interpolated between frames, inside the viewport. */
function LiveOnItinerary({ city, itinerary, enabled, onCount }: { city: string; itinerary: Itinerary | null; enabled: boolean; onCount: (n: number) => void }) {
  const routeIds = useMemo(() => new Set(itinerary?.legs.map((l) => l.route?.id).filter(Boolean) as string[]), [itinerary]);
  const stream = useVehicleStream(city, enabled && routeIds.size > 0);
  const raw = useMemo(
    () => (routeIds.size ? [...stream.vehicles.values()].filter((v) => v.routeId && routeIds.has(v.routeId)) : []),
    [stream.vehicles, routeIds],
  );
  const bbox = useMapBounds();
  const vehicles = useInterpolatedVehicles(raw, { bbox, cap: 300 });
  useEffect(() => onCount(raw.length), [raw.length, onCount]);
  return vehicles.length ? <VehiclesLayer vehicles={vehicles} /> : null;
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
  const [draft, setDraft] = useState<PlannerState>(urlState);
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const [locating, setLocating] = useState<"from" | "to" | "hub" | null>(null);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [sort, setSort] = useState<SortKey>("default");
  const [showPois, setShowPois] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
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
  const planParams = useMemo(() => toPlanParams(urlState, lang), [urlState, lang]);
  const plan = usePlan(city.id, planParams);
  const itineraries = useMemo(() => sortItineraries(plan.data?.itineraries ?? [], sort, city.fares), [plan.data, sort, city.fares]);
  const selected = urlState.selected !== null ? (plan.data?.itineraries ?? [])[urlState.selected] ?? null : null;

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
    if (!pos || kind === "hub") return;
    let name: string = t.planner.myLocation;
    try {
      name = (await api.reverse(city.id, pos.lat, pos.lon)).name;
    } catch {
      /* keep generic name */
    }
    const next = { ...draft, [kind]: { ...pos, name }, selected: null };
    setDraft(next);
    if (next.from && next.to) commit(next);
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
    setSheetOpen(true);
    if (next.from && next.to) commit(next);
  };

  const openPlanner = () => commit(draft, { view: "plan" });
  const usePlace = async (p: { lat: number; lon: number; name: string }, kind: "to" | "from") => {
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

  const panel = showHub ? (
    <Hub city={city} onPlan={openPlanner} onLocate={() => locateFor("hub")} pos={geo.pos} locating={locating === "hub"} onUsePlace={usePlace} />
  ) : (
    <div className="flex flex-col">
      {selected ? (
        /* Compact summary while reading an itinerary; the form comes back on "edit". */
        <button
          type="button"
          onClick={() => commit({ ...urlState, selected: null })}
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper-3"
          aria-label={t.planner.back}
        >
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
          <Icon.Chevron className="shrink-0 rotate-90 text-ink-3" />
        </button>
      ) : (
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-xl font-extrabold tracking-tight">{t.planner.title}</h1>
            <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-3 hover:text-ink">
              <Icon.Back width={14} height={14} /> {t.nav.home}
            </button>
          </div>
          <PlannerForm
            city={city}
            state={draft}
            onChange={setDraft}
            onSubmit={() => commit({ ...draft, selected: null }, { view: "plan" })}
            onUseLocation={locateFor}
            onPickOnMap={(k) => {
              setPicking(k);
              setSheetOpen(false);
            }}
            picking={picking}
            locating={locating === "from" || locating === "to" ? locating : null}
            userPos={geo.pos}
            compact={!!selected}
            bikeEnabled={cfg.features.bike}
          />
          {geo.error ? <p className="mt-2 text-xs text-brick">{t.planner.locationDenied}</p> : null}
          {picking ? <p className="mt-2 rounded-md bg-amber/30 px-2 py-1 text-xs font-semibold">{t.planner.pickOnMapHint}</p> : null}
          {!planParams && fav.recents.length ? (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-ink-2">{t.favorites.recents}</p>
              <ul className="flex flex-col gap-1">
                {fav.recents.slice(0, 3).map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => commit({ ...draft, from: r.from, to: r.to, selected: null }, { view: "plan" })}
                      className="flex w-full items-center gap-2 rounded-lg border border-line bg-paper-2 px-3 py-2 text-left text-sm hover:border-ink"
                    >
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

      <div className="border-t border-line" />

      {selected ? (
        <ItineraryDetail
          itinerary={selected}
          city={city}
          liveCount={liveCount}
          endpoints={{ from: draft.from?.name, to: draft.to?.name }}
          onBack={() => commit({ ...urlState, selected: null })}
        />
      ) : (
        <div className="flex flex-col gap-3 p-4">
          {!planParams ? (
            <EmptyState title={t.planner.emptyTitle} hint={t.planner.emptyHint} icon={<Icon.Map />} />
          ) : plan.isLoading ? (
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
      )}
    </div>
  );

  const compColors = useMemo(() => Object.fromEntries(componentsOf(city).map((c) => [c.id, c.color])), [city]);

  return (
    <SplitLayout
      sheetOpen={sheetOpen}
      onSheetOpenChange={setSheetOpen}
      panel={panel}
      map={
        <MapView center={[city.center.lon, city.center.lat]} zoom={city.defaultZoom} attribution={city.attribution} onClick={onMapClick} className={`h-full w-full ${picking ? "cursor-crosshair" : ""}`}>
          {!selected && nearby.data ? <StopsLayer stops={nearby.data.stops} onClick={(s) => router.push(`/${city.id}/stops/${encodeURIComponent(s.id)}`)} /> : null}
          <ItineraryLayer itinerary={selected} />
          {!selected && draft.from && draft.to ? <FitPoints a={draft.from} b={draft.to} /> : null}
          {cfg.features.liveVehicles ? <LiveOnItinerary city={city.id} itinerary={selected} enabled={cfg.features.liveVehicles} onCount={onCount} /> : null}
          {cfg.features.pois ? <PoisInView city={city.id} enabled={showPois} /> : null}
          {draft.from ? <PinMarker kind="from" lat={draft.from.lat} lon={draft.from.lon} /> : null}
          {draft.to ? <PinMarker kind="to" lat={draft.to.lat} lon={draft.to.lon} /> : null}
          {geo.pos ? <PinMarker kind="user" lat={geo.pos.lat} lon={geo.pos.lon} /> : null}
          {cfg.features.pois ? <MapToggle on={showPois} onClick={() => setShowPois((v) => !v)} label={showPois ? t.pois.hide : t.pois.show} icon={<Icon.Services width={18} height={18} />} /> : null}
          <span className="sr-only">{Object.keys(compColors).length}</span>
        </MapView>
      }
    />
  );
}
