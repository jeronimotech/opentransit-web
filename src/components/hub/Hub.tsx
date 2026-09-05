"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { useAlerts, useBoard, useNearbyRental, useNearbyStops } from "@/lib/api/hooks";
import { availabilityTone, bikeShareEnabled, formatAvailability, networkById, stationAgeSeconds } from "@/lib/rental";
import { useFavorites } from "@/lib/favorites";
import { resolveConfig, componentOf } from "@/lib/city-config";
import { Icon, Spinner } from "@/components/ui/primitives";
import { ComponentIcon } from "@/components/ui/ComponentIcon";
import { RouteChip } from "@/components/ui/RouteChip";
import { StatusText } from "@/components/ui/FreshnessBadge";
import { AlertCarousel } from "./AlertCarousel";
import type { City, NearbyRentalStation, NearbyStop } from "@/lib/api/types";

/**
 * Map-first home (UX audit A). The sheet peeks with only what the nav does not already
 * offer: three action chips and "Cerca de ti". Casa/Trabajo, recents, notices and
 * service hand-offs appear once the sheet is pulled up (`expanded`).
 */
export function Hub({
  city,
  onPlan,
  onLocate,
  pos,
  locating,
  onUsePlace,
  expanded,
  showSearch = true,
}: {
  city: City;
  onPlan: () => void;
  onLocate: () => void;
  pos: { lat: number; lon: number } | null;
  locating: boolean;
  onUsePlace: (p: { lat: number; lon: number; name: string }, kind: "to" | "from") => void;
  expanded: boolean;
  /** Desktop renders the search pill inside the panel; phones float it over the map. */
  showSearch?: boolean;
}) {
  const { t } = useI18n();
  const cfg = resolveConfig(city);
  const base = `/${city.id}`;
  const alerts = useAlerts(city.id);
  const nearby = useNearbyStops(city.id, pos, 700);
  const bikes = bikeShareEnabled(city);
  const nearRental = useNearbyRental(city.id, pos, 700, bikes);
  const nearestBike = nearRental.data?.[0] ?? null;
  const fav = useFavorites(city.id);
  const home = fav.places.find((p) => p.placeKind === "home");
  const work = fav.places.find((p) => p.placeKind === "work");

  // three equal chips, icon above a one-line label, 56 px tall (≥ 44 px target)
  const chipBase = "flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl border px-1 text-[12px] font-bold leading-none";
  const chip = `${chipBase} border-line bg-paper-2 text-ink hover:border-ink`;
  const chipPrimary = `${chipBase} border-ink bg-ink text-paper`;

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-1 md:pt-4">
      {showSearch ? (
        <button type="button" onClick={onPlan} className="hidden h-12 w-full items-center gap-3 rounded-xl border border-line bg-paper px-3 text-left text-[15px] text-ink-3 shadow-sm hover:border-line-2 md:flex">
          <Icon.Search className="text-ink-2" />
          <span className="flex-1">{t.hub.searchPlaceholder}</span>
          <span className="rounded-md bg-signal px-2 py-1 text-xs font-bold text-signal-ink">{t.planner.search}</span>
        </button>
      ) : null}

      {/* 1 · three actions, one line */}
      <div className="flex gap-2" role="group" aria-label={t.hub.greeting}>
        <button type="button" onClick={onPlan} className={chipPrimary}>
          <Icon.Route width={20} height={20} /> <span className="whitespace-nowrap">{t.hub.plan}</span>
        </button>
        {cfg.features.next ? (
          <Link href={`${base}/next`} className={chip}>
            <Icon.Bus width={20} height={20} /> <span className="whitespace-nowrap">{t.hub.next}</span>
          </Link>
        ) : null}
        <Link href={`${base}/routes`} className={chip}>
          <Icon.Search width={20} height={20} /> <span className="whitespace-nowrap">{t.hub.routes}</span>
        </Link>
      </div>

      {/* 2 · Cerca de ti */}
      <section aria-labelledby="nearby-title">
        <div className="mb-1.5 flex items-baseline justify-between">
          <h2 id="nearby-title" className="text-sm font-bold">
            {t.hub.nearYou}
          </h2>
          {pos ? (
            <button type="button" onClick={onLocate} className="text-xs font-semibold text-signal">
              {t.common.retry}
            </button>
          ) : null}
        </div>
        {!pos ? (
          <button type="button" onClick={onLocate} className="flex h-[76px] w-full items-center gap-3 rounded-xl border border-dashed border-line-2 px-3 text-left text-sm hover:border-ink">
            {locating ? <Spinner /> : <Icon.Locate className="text-signal" />}
            <span>
              <span className="block font-semibold">{locating ? t.planner.locating : t.hub.nearbyLocate}</span>
              <span className="block text-xs text-ink-3">{t.hub.nearYouHint}</span>
            </span>
          </button>
        ) : nearby.isLoading ? (
          <div className="flex h-[76px] items-center">
            <Spinner />
          </div>
        ) : !nearby.data?.stops.length && !nearestBike ? (
          <p className="text-sm text-ink-3">{t.hub.nearbyEmpty}</p>
        ) : (
          <ul className="rail -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
            {/* stops and the nearest shared-bike station, ordered by distance */}
            {[...(nearby.data?.stops.slice(0, 8) ?? []).map((s) => ({ kind: "stop" as const, d: s.distanceMeters, s })), ...(nearestBike ? [{ kind: "bike" as const, d: nearestBike.distanceMeters, s: nearestBike }] : [])]
              .sort((a, b) => a.d - b.d)
              .map((x) =>
                x.kind === "bike" ? (
                  <NearbyBikeCard key={x.s.id} city={city} station={x.s} />
                ) : (
                  <NearbyCard key={x.s.id} city={city} stop={x.s} refreshMs={cfg.departuresRefreshSeconds * 1000} boardEnabled={cfg.features.board} />
                ),
              )}
          </ul>
        )}
      </section>

      {!expanded ? <p className="text-center text-[11px] text-ink-3 md:hidden">{t.hub.dragHint}</p> : null}

      {expanded ? (
        <>
          {home || work ? (
            <div className="flex gap-2">
              {home ? (
                <button type="button" onClick={() => onUsePlace(home, "to")} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-paper-2 px-4 text-sm font-semibold text-ink-2 hover:border-ink hover:text-ink">
                  <Icon.Home width={16} height={16} /> {t.favorites.goHome}
                </button>
              ) : null}
              {work ? (
                <button type="button" onClick={() => onUsePlace(work, "to")} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-paper-2 px-4 text-sm font-semibold text-ink-2 hover:border-ink hover:text-ink">
                  <Icon.Work width={16} height={16} /> {t.favorites.goWork}
                </button>
              ) : null}
            </div>
          ) : null}

          {fav.recents.length ? (
            <section>
              <div className="mb-1.5 flex items-baseline justify-between">
                <h2 className="text-sm font-bold">{t.hub.recent}</h2>
                <button type="button" onClick={fav.clearRecents} className="text-xs font-semibold text-ink-3 hover:text-ink">
                  {t.hub.clearRecent}
                </button>
              </div>
              <ul className="flex flex-col gap-1">
                {fav.recents.slice(0, 4).map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`${base}?from=${r.from.lat.toFixed(5)},${r.from.lon.toFixed(5)}&fromName=${encodeURIComponent(r.from.name ?? "")}&to=${r.to.lat.toFixed(5)},${r.to.lon.toFixed(5)}&toName=${encodeURIComponent(r.to.name ?? "")}`}
                      className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-paper-2 px-3 py-2 text-sm hover:border-ink"
                    >
                      <Icon.Clock width={16} height={16} className="shrink-0 text-ink-3" />
                      <span className="truncate">
                        <span className="font-semibold">{r.from.name ?? "…"}</span> → <span className="font-semibold">{r.to.name ?? "…"}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {cfg.features.alerts ? <AlertCarousel city={city.id} alerts={alerts.data?.alerts ?? []} /> : null}

          {city.services?.length ? (
            <section>
              <h2 className="mb-1.5 text-sm font-bold">{t.hub.services}</h2>
              <ul className="flex flex-wrap gap-2">
                {city.services.map((sv) => (
                  <li key={sv.id}>
                    <a
                      href={sv.url}
                      target={sv.kind === "external" ? "_blank" : undefined}
                      rel="noreferrer noopener"
                      className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-line bg-paper-2 px-3 text-sm font-semibold text-ink-2 hover:border-ink hover:text-ink"
                      title={sv.kind === "external" ? t.links.external : undefined}
                    >
                      {sv.label}
                      {sv.kind === "external" ? <Icon.External width={12} height={12} className="text-ink-3" /> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** One "Cerca de ti" card: component, name, distance and the next two arrivals across routes. */
function NearbyCard({ city, stop, refreshMs, boardEnabled }: { city: City; stop: NearbyStop; refreshMs: number; boardEnabled: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const board = useBoard(city.id, stop.id, refreshMs, boardEnabled);
  const comp = componentOf(city, stop.component ?? board.data?.rows[0]?.route.component ?? null);
  const next = (board.data?.rows ?? [])
    .flatMap((r) => r.next.slice(0, 1).map((n) => ({ ...n, route: r.route })))
    .sort((a, b) => a.minutes - b.minutes)
    .slice(0, 2);
  const href = `/${city.id}/stops/${encodeURIComponent(stop.id)}`;
  return (
    <li className="w-[196px] shrink-0 snap-start">
      <button type="button" onClick={() => router.push(href)} className="flex h-full w-full flex-col gap-1.5 rounded-xl border border-line bg-paper-2 p-2.5 text-left hover:border-ink" aria-label={stop.name}>
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white" style={{ background: comp.color }}>
            <ComponentIcon icon={comp.icon} width={15} height={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold leading-tight">{stop.name}</span>
            <span className="block text-[11px] text-ink-3">
              {Math.round(stop.distanceMeters)} m · {stop.locationType === "station" ? t.common.station : comp.label}
            </span>
          </span>
        </span>
        <span className="flex min-h-6 items-center gap-2 text-xs">
          {board.isLoading ? (
            <Spinner className="h-3 w-3" />
          ) : next.length ? (
            next.map((n) => (
              <span key={`${n.route.id}-${n.time}`} className="inline-flex items-center gap-1">
                <RouteChip route={n.route} size="sm" />
                <span className={`tabular-nums font-bold ${n.realtime ? "text-ink" : "text-ink-2"}`}>{t.stop.inMin(n.minutes)}</span>
                {n.realtime ? <span className="h-1.5 w-1.5 rounded-full bg-moss" aria-hidden /> : null}
              </span>
            ))
          ) : (
            <StatusText tone="scheduled" label={t.hub.noTimes} live={false} />
          )}
        </span>
      </button>
    </li>
  );
}


/** Nearest shared-bike station: network colour, name, "6 bicis · 13 puestos", distance. */
function NearbyBikeCard({ city, station }: { city: City; station: NearbyRentalStation }) {
  const { t, lang } = useI18n();
  const net = networkById(city, station.networkId);
  const color = net?.color ?? "#00A859";
  const tone = availabilityTone(station.vehiclesAvailable);
  const age = stationAgeSeconds(station.lastReported);
  const href = `/${city.id}?lat=${station.lat.toFixed(5)}&lon=${station.lon.toFixed(5)}&zoom=16.5`;
  return (
    <li className="w-[196px] shrink-0 snap-start">
      <Link href={href} className="flex h-full w-full flex-col gap-1.5 rounded-xl border border-line bg-paper-2 p-2.5 text-left hover:border-ink" aria-label={`${net?.name ?? t.rental.station}: ${station.name}`}>
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white" style={{ background: color }}>
            <Icon.Bike width={15} height={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold leading-tight">{station.name}</span>
            <span className="block text-[11px] text-ink-3">
              {Math.round(station.distanceMeters)} m · {net?.name ?? t.hub.bikeStation}
            </span>
          </span>
        </span>
        <span className="flex min-h-6 items-center gap-2 text-xs">
          <span className={`font-bold ${tone === "none" ? "text-brick" : tone === "low" ? "text-amber-ink" : "text-ink"}`}>{tone === "none" ? t.rental.none : formatAvailability(station.vehiclesAvailable, station.docksAvailable, lang)}</span>
          {age != null ? <span className={`h-1.5 w-1.5 rounded-full ${age > 180 ? "bg-amber" : "bg-moss"}`} aria-hidden title={t.rental.updatedAgo(age)} /> : null}
        </span>
      </Link>
    </li>
  );
}
