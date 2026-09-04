"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useCityCtx } from "@/components/shell/CityContext";
import { SplitLayout } from "@/components/shell/SplitLayout";
import { MapView, useFitBounds } from "@/components/map/MapView";
import { ItineraryLayer, PinMarker, StopsLayer, VehiclesLayer } from "@/components/map/layers";
import { PlannerForm } from "@/components/planner/PlannerForm";
import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import { ItineraryDetail } from "@/components/itinerary/ItineraryDetail";
import { EmptyState, Icon, Spinner } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n/provider";
import { useNearbyStops, usePlan } from "@/lib/api/hooks";
import { api, ApiRequestError } from "@/lib/api/client";
import { useVehicleStream } from "@/lib/api/stream";
import { useGeolocation } from "@/lib/use-geolocation";
import { readPlanner, toPlanParams, writePlanner, type PlannerState } from "@/lib/planner-params";

/** Keeps origin and destination in view while the person compares options. */
function FitPoints({ a, b }: { a: { lat: number; lon: number }; b: { lat: number; lon: number } }) {
  const small = typeof window !== "undefined" && window.innerWidth < 768;
  useFitBounds(
    [Math.min(a.lon, b.lon), Math.min(a.lat, b.lat), Math.max(a.lon, b.lon), Math.max(a.lat, b.lat)],
    small ? { top: 80, bottom: 320, left: 40, right: 40 } : { top: 80, bottom: 60, left: 470, right: 60 },
  );
  return null;
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
  const { t, lang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const urlState = useMemo(() => readPlanner(new URLSearchParams(sp.toString())), [sp]);
  const [draft, setDraft] = useState<PlannerState>(urlState);
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const [locating, setLocating] = useState<"from" | "to" | null>(null);
  const [sheetOpen, setSheetOpen] = useState(true);
  const geo = useGeolocation();

  // URL → draft (back/forward, shared links)
  useEffect(() => {
    setDraft(urlState);
  }, [urlState]);

  const commit = useCallback(
    (s: PlannerState) => {
      const q = writePlanner(s).toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const planParams = useMemo(() => toPlanParams(urlState, lang), [urlState, lang]);
  const plan = usePlan(city.id, planParams);
  const itineraries = plan.data?.itineraries ?? [];
  const selected = urlState.selected !== null ? itineraries[urlState.selected] ?? null : null;

  // Live vehicles only for the routes in the selected itinerary
  const routeIds = useMemo(() => new Set(selected?.legs.map((l) => l.route?.id).filter(Boolean) as string[]), [selected]);
  const stream = useVehicleStream(city.id, city.features.realtimeVehicles && routeIds.size > 0);
  const liveVehicles = useMemo(
    () => (routeIds.size ? [...stream.vehicles.values()].filter((v) => v.routeId && routeIds.has(v.routeId)) : []),
    [stream.vehicles, routeIds],
  );

  const nearby = useNearbyStops(city.id, geo.pos, 700);

  const useLocation = async (kind: "from" | "to") => {
    setLocating(kind);
    const pos = await geo.locate();
    setLocating(null);
    if (!pos) return;
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

  const routerDown = plan.error instanceof ApiRequestError && plan.error.status >= 500;

  const panel = (
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
        <h1 className="mb-3 text-xl font-extrabold tracking-tight">{t.planner.title}</h1>
        <PlannerForm
          city={city}
          state={draft}
          onChange={setDraft}
          onSubmit={() => commit({ ...draft, selected: null })}
          onUseLocation={useLocation}
          onPickOnMap={(k) => {
            setPicking(k);
            setSheetOpen(false);
          }}
          picking={picking}
          locating={locating}
          userPos={geo.pos}
          compact={!!selected}
        />
        {geo.error ? <p className="mt-2 text-xs text-brick">{t.planner.locationDenied}</p> : null}
        {picking ? (
          <p className="mt-2 rounded-md bg-amber/30 px-2 py-1 text-xs font-semibold">{t.planner.pickOnMapHint}</p>
        ) : null}
      </div>
      )}

      <div className="border-t border-line" />

      {selected ? (
        <ItineraryDetail
          itinerary={selected}
          city={city.id}
          tz={city.timezone}
          liveCount={liveVehicles.length}
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
              {itineraries.map((it, i) => (
                <ItineraryCard
                  key={it.id}
                  index={i}
                  itinerary={it}
                  tz={city.timezone}
                  selected={false}
                  onSelect={() => commit({ ...urlState, selected: i })}
                />
              ))}
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

  return (
    <SplitLayout
      sheetOpen={sheetOpen}
      onSheetOpenChange={setSheetOpen}
      panel={panel}
      map={
        <MapView
          center={[city.center.lon, city.center.lat]}
          zoom={city.defaultZoom}
          attribution={city.attribution}
          onClick={onMapClick}
          className={`h-full w-full ${picking ? "cursor-crosshair" : ""}`}
        >
          {!selected && nearby.data ? (
            <StopsLayer stops={nearby.data.stops} onClick={(s) => router.push(`/${city.id}/stops/${encodeURIComponent(s.id)}`)} />
          ) : null}
          <ItineraryLayer itinerary={selected} />
          {!selected && draft.from && draft.to ? <FitPoints a={draft.from} b={draft.to} /> : null}
          {liveVehicles.length ? <VehiclesLayer vehicles={liveVehicles} /> : null}
          {draft.from ? <PinMarker kind="from" lat={draft.from.lat} lon={draft.from.lon} /> : null}
          {draft.to ? <PinMarker kind="to" lat={draft.to.lat} lon={draft.to.lon} /> : null}
          {geo.pos ? <PinMarker kind="user" lat={geo.pos.lat} lon={geo.pos.lon} /> : null}
        </MapView>
      }
    />
  );
}
