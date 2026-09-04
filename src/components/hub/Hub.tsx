"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useAlerts, useNearbyStops } from "@/lib/api/hooks";
import { useFavorites } from "@/lib/favorites";
import { resolveConfig, componentOf } from "@/lib/city-config";
import { Icon, Spinner } from "@/components/ui/primitives";
import { ComponentIcon } from "@/components/ui/ComponentIcon";
import { AlertCarousel } from "./AlertCarousel";
import type { City } from "@/lib/api/types";
import type { ReactNode } from "react";

/**
 * Question-led home (TransMi App's "Hola, ¿qué quieres consultar?" + Maas's
 * "¿A dónde quieres ir?" and nearby card, merged). Feature flags from the city
 * config hide modules; the planner is one tap away and shareable URLs still work.
 */
export function Hub({
  city,
  onPlan,
  onLocate,
  pos,
  locating,
  onUsePlace,
}: {
  city: City;
  onPlan: () => void;
  onLocate: () => void;
  pos: { lat: number; lon: number } | null;
  locating: boolean;
  onUsePlace: (p: { lat: number; lon: number; name: string }, kind: "to" | "from") => void;
}) {
  const { t } = useI18n();
  const cfg = resolveConfig(city);
  const base = `/${city.id}`;
  const alerts = useAlerts(city.id);
  const nearby = useNearbyStops(city.id, pos, 700);
  const fav = useFavorites(city.id);
  const home = fav.places.find((p) => p.placeKind === "home");
  const work = fav.places.find((p) => p.placeKind === "work");

  const tiles = useMemo(
    () =>
      (
        [
          { key: "plan", show: true, href: null, icon: <Icon.Route />, title: t.hub.plan, hint: t.hub.planHint },
          { key: "next", show: cfg.features.next, href: `${base}/next`, icon: <Icon.Bus />, title: t.hub.next, hint: t.hub.nextHint },
          { key: "nearby", show: true, href: null, icon: <Icon.Locate />, title: t.hub.nearby, hint: t.hub.nearbyHint },
          { key: "routes", show: true, href: `${base}/routes`, icon: <Icon.Search />, title: t.hub.routes, hint: t.hub.routesHint },
          { key: "live", show: cfg.features.liveVehicles, href: `${base}/live`, icon: <Icon.Map />, title: t.hub.live, hint: t.hub.liveHint },
          { key: "alerts", show: cfg.features.alerts, href: `${base}/alerts`, icon: <Icon.Alert />, title: t.hub.alerts, hint: t.hub.alertsHint },
          { key: "favorites", show: cfg.features.favorites, href: `${base}/favorites`, icon: <Icon.Star />, title: t.hub.favorites, hint: t.hub.favoritesHint },
        ] as { key: string; show: boolean; href: string | null; icon: ReactNode; title: string; hint: string }[]
      ).filter((x) => x.show),
    [t, cfg.features, base],
  );

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">{t.hub.greeting}</h1>
        <button
          type="button"
          onClick={onPlan}
          className="mt-3 flex h-12 w-full items-center gap-3 rounded-xl border border-line bg-paper px-3 text-left text-[15px] text-ink-3 shadow-sm hover:border-line-2"
        >
          <Icon.Search className="text-ink-2" />
          <span className="flex-1">{t.hub.searchPlaceholder}</span>
          <span className="rounded-md bg-signal px-2 py-1 text-xs font-bold text-signal-ink">{t.planner.search}</span>
        </button>
        {home || work ? (
          <div className="mt-2 flex gap-2">
            {home ? (
              <button type="button" onClick={() => onUsePlace(home, "to")} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-paper-2 px-3 text-xs font-semibold text-ink-2 hover:border-ink hover:text-ink">
                <Icon.Home width={14} height={14} /> {t.favorites.goHome}
              </button>
            ) : null}
            {work ? (
              <button type="button" onClick={() => onUsePlace(work, "to")} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-paper-2 px-3 text-xs font-semibold text-ink-2 hover:border-ink hover:text-ink">
                <Icon.Work width={14} height={14} /> {t.favorites.goWork}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <ul className="grid grid-cols-2 gap-2" aria-label={t.hub.greeting}>
        {tiles.map((tile) => {
          const inner = (
            <>
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-paper-3 text-ink">{tile.icon}</span>
              <span className="mt-2 block text-sm font-bold leading-tight">{tile.title}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-ink-3">{tile.hint}</span>
            </>
          );
          const cls = "block h-full w-full rounded-card border border-line bg-paper-2 p-3 text-left transition-colors hover:border-ink";
          return (
            <li key={tile.key}>
              {tile.href ? (
                <Link href={tile.href} className={cls}>
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={tile.key === "plan" ? onPlan : onLocate} className={cls}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {cfg.features.alerts ? <AlertCarousel city={city.id} alerts={alerts.data?.alerts ?? []} /> : null}

      <section aria-labelledby="nearby-title">
        <div className="mb-1.5 flex items-baseline justify-between">
          <h2 id="nearby-title" className="text-sm font-semibold text-ink-2">
            {t.hub.nearbyTitle}
          </h2>
          {pos ? (
            <button type="button" onClick={onLocate} className="text-xs font-semibold text-signal">
              {t.common.retry}
            </button>
          ) : null}
        </div>
        {!pos ? (
          <button type="button" onClick={onLocate} className="flex w-full items-center gap-3 rounded-card border border-dashed border-line-2 p-3 text-left text-sm hover:border-ink">
            {locating ? <Spinner /> : <Icon.Locate className="text-signal" />}
            <span className="font-semibold">{locating ? t.planner.locating : t.hub.nearbyLocate}</span>
          </button>
        ) : nearby.isLoading ? (
          <Spinner />
        ) : !nearby.data?.stops.length ? (
          <p className="text-sm text-ink-3">{t.hub.nearbyEmpty}</p>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-paper-2">
            {nearby.data.stops.slice(0, 6).map((s) => {
              const comp = componentOf(city, s.component);
              return (
                <li key={s.id}>
                  <Link href={`${base}/stops/${encodeURIComponent(s.id)}`} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-paper-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white" style={{ background: comp.color }}>
                      <ComponentIcon icon={comp.icon} width={16} height={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{s.name}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {s.locationType === "station" ? t.common.station : t.common.stop} · {comp.label}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-xs text-ink-3">{Math.round(s.distanceMeters)} m</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {fav.recents.length ? (
        <section>
          <div className="mb-1.5 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink-2">{t.hub.recent}</h2>
            <button type="button" onClick={fav.clearRecents} className="text-xs font-semibold text-ink-3 hover:text-ink">
              {t.hub.clearRecent}
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {fav.recents.slice(0, 4).map((r) => (
              <li key={r.id}>
                <Link
                  href={`${base}?from=${r.from.lat.toFixed(5)},${r.from.lon.toFixed(5)}&fromName=${encodeURIComponent(r.from.name ?? "")}&to=${r.to.lat.toFixed(5)},${r.to.lon.toFixed(5)}&toName=${encodeURIComponent(r.to.name ?? "")}`}
                  className="flex items-center gap-2 rounded-lg border border-line bg-paper-2 px-3 py-2 text-sm hover:border-ink"
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

      {city.services?.length ? (
        <section>
          <h2 className="mb-1.5 text-sm font-semibold text-ink-2">{t.hub.services}</h2>
          <ul className="flex flex-wrap gap-2">
            {city.services.map((sv) => (
              <li key={sv.id}>
                <a
                  href={sv.url}
                  target={sv.kind === "external" ? "_blank" : undefined}
                  rel="noreferrer noopener"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-paper-2 px-3 text-sm font-semibold text-ink-2 hover:border-ink hover:text-ink"
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
    </div>
  );
}
