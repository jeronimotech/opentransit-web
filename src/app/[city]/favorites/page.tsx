"use client";

import { cleanHeadsign } from "@/lib/text";

import Link from "next/link";
import { useState } from "react";
import { useCityCtx } from "@/components/shell/CityContext";
import { PlaceInput } from "@/components/planner/PlaceInput";
import { Button, EmptyState, Icon, Spinner } from "@/components/ui/primitives";
import { RouteChip } from "@/components/ui/RouteChip";
import { FreshnessBadge } from "@/components/ui/FreshnessBadge";
import { useI18n } from "@/lib/i18n/provider";
import { useScreenView } from "@/lib/analytics";
import { useBoard, useRoute } from "@/lib/api/hooks";
import { useFavorites, type FavPlace, type FavRoute, type FavStop, type PlaceKind } from "@/lib/favorites";
import { serviceStatus } from "@/lib/service-window";
import { resolveConfig } from "@/lib/city-config";
import type { PlannerPoint } from "@/lib/planner-params";

/** Favorites with live context: stops show their next departures, routes their service window. */
export default function FavoritesPage() {
  const city = useCityCtx();
  useScreenView(city.id, "favorites");
  const cfg = resolveConfig(city);
  const { t } = useI18n();
  const fav = useFavorites(city.id);
  const [editing, setEditing] = useState<PlaceKind | null>(null);
  const [draft, setDraft] = useState<PlannerPoint | null>(null);
  const [customName, setCustomName] = useState("");
  const home = fav.places.find((p) => p.placeKind === "home");
  const work = fav.places.find((p) => p.placeKind === "work");
  const customs = fav.places.filter((p) => p.placeKind === "custom");
  const planTo = (p: FavPlace) => `/${city.id}?to=${p.lat.toFixed(5)},${p.lon.toFixed(5)}&toName=${encodeURIComponent(p.name)}&view=plan`;
  const planFrom = (p: FavPlace) => `/${city.id}?from=${p.lat.toFixed(5)},${p.lon.toFixed(5)}&fromName=${encodeURIComponent(p.name)}&view=plan`;

  const save = () => {
    if (!editing || !draft) return;
    const name = editing === "custom" ? customName.trim() || draft.name || t.favorites.custom : draft.name || (editing === "home" ? t.favorites.home : t.favorites.work);
    fav.setPlace(editing, { name, lat: draft.lat, lon: draft.lon });
    setEditing(null);
    setDraft(null);
    setCustomName("");
  };

  const empty = !fav.favorites.length && !fav.recents.length;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-24 md:pt-28">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t.favorites.title}</h1>
      <p className="mt-1 text-sm text-ink-2">{t.favorites.hint}</p>

      {/* Places */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-ink-2">{t.favorites.places}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          <PlaceCard kind="home" place={home} icon={<Icon.Home />} label={t.favorites.home} onSet={() => setEditing("home")} onRemove={() => fav.remove("place", "home")} planTo={planTo} planFrom={planFrom} />
          <PlaceCard kind="work" place={work} icon={<Icon.Work />} label={t.favorites.work} onSet={() => setEditing("work")} onRemove={() => fav.remove("place", "work")} planTo={planTo} planFrom={planFrom} />
          {customs.map((p) => (
            <PlaceCard key={p.id} kind="custom" place={p} icon={<Icon.Pin />} label={p.name} onSet={() => setEditing("custom")} onRemove={() => fav.remove("place", p.id)} planTo={planTo} planFrom={planFrom} />
          ))}
          <li>
            <button type="button" onClick={() => setEditing("custom")} className="flex h-full w-full items-center gap-2 rounded-card border border-dashed border-line-2 p-3 text-sm font-semibold text-ink-2 hover:border-ink hover:text-ink">
              <Icon.Pin width={16} height={16} /> {t.favorites.addPlace}
            </button>
          </li>
        </ul>
        {editing ? (
          <div className="mt-3 rounded-card border border-line bg-paper-2 p-3">
            <p className="mb-2 text-sm font-bold">{editing === "home" ? t.favorites.setHome : editing === "work" ? t.favorites.setWork : t.favorites.addPlace}</p>
            <PlaceInput city={city.id} kind="to" label={t.favorites.pickPlace} placeholder={t.favorites.pickPlace} value={draft} near={city.center} onChange={setDraft} autoFocus />
            {editing === "custom" ? (
              <input className="mt-2 h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm" placeholder={t.favorites.name} value={customName} onChange={(e) => setCustomName(e.target.value)} aria-label={t.favorites.name} />
            ) : null}
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="primary" disabled={!draft} onClick={save}>
                {t.favorites.save}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                {t.favorites.cancel}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Stops */}
      {fav.stops.length ? (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-ink-2">{t.favorites.stops}</h2>
          <ul className="flex flex-col gap-2">
            {fav.stops.map((s) => (
              <StopCard key={s.id} fav={s} city={city.id} refreshMs={cfg.departuresRefreshSeconds * 1000} boardEnabled={cfg.features.board} onRemove={() => fav.remove("stop", s.id)} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* Routes */}
      {fav.routes.length ? (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-ink-2">{t.favorites.routes}</h2>
          <ul className="flex flex-col gap-2">
            {fav.routes.map((r) => (
              <RouteCard key={r.id} fav={r} city={city.id} onRemove={() => fav.remove("route", r.id)} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* Recents */}
      <section className="mt-8">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink-2">{t.favorites.recents}</h2>
          {fav.recents.length ? (
            <button type="button" onClick={fav.clearRecents} className="text-xs font-semibold text-ink-3 hover:text-ink">
              {t.hub.clearRecent}
            </button>
          ) : null}
        </div>
        {!fav.recents.length ? (
          <p className="text-sm text-ink-3">{t.favorites.noRecents}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {fav.recents.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/${city.id}?from=${r.from.lat.toFixed(5)},${r.from.lon.toFixed(5)}&fromName=${encodeURIComponent(r.from.name ?? "")}&to=${r.to.lat.toFixed(5)},${r.to.lon.toFixed(5)}&toName=${encodeURIComponent(r.to.name ?? "")}`}
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
        )}
      </section>

      {empty ? (
        <div className="mt-8">
          <EmptyState title={t.favorites.empty} hint={t.favorites.emptyHint} icon={<Icon.Star />} />
        </div>
      ) : null}
    </main>
  );
}

function PlaceCard({
  kind,
  place,
  icon,
  label,
  onSet,
  onRemove,
  planTo,
  planFrom,
}: {
  kind: PlaceKind;
  place: FavPlace | undefined;
  icon: React.ReactNode;
  label: string;
  onSet: () => void;
  onRemove: () => void;
  planTo: (p: FavPlace) => string;
  planFrom: (p: FavPlace) => string;
}) {
  const { t } = useI18n();
  return (
    <li className="flex items-center gap-3 rounded-card border border-line bg-paper-2 p-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-paper-3 text-ink">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{label}</p>
        {place ? <p className="truncate text-xs text-ink-3">{kind === "custom" ? `${place.lat.toFixed(4)}, ${place.lon.toFixed(4)}` : place.name}</p> : <p className="text-xs text-ink-3">—</p>}
        {place ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Link href={planTo(place)} className="rounded-md bg-signal px-2 py-1 text-xs font-bold text-signal-ink">
              {kind === "home" ? t.favorites.goHome : kind === "work" ? t.favorites.goWork : t.favorites.go}
            </Link>
            <Link href={planFrom(place)} className="rounded-md bg-paper-3 px-2 py-1 text-xs font-semibold">
              {t.favorites.from}
            </Link>
            <button type="button" onClick={onRemove} className="px-1 text-xs font-semibold text-ink-3 hover:text-brick">
              {t.favorites.remove}
            </button>
          </div>
        ) : (
          <button type="button" onClick={onSet} className="mt-1.5 text-xs font-semibold text-signal">
            {kind === "home" ? t.favorites.setHome : kind === "work" ? t.favorites.setWork : t.favorites.addPlace}
          </button>
        )}
      </div>
    </li>
  );
}

function StopCard({ fav, city, refreshMs, boardEnabled, onRemove }: { fav: FavStop; city: string; refreshMs: number; boardEnabled: boolean; onRemove: () => void }) {
  const { t } = useI18n();
  const board = useBoard(city, fav.stopId, refreshMs, boardEnabled);
  return (
    <li className="rounded-card border border-line bg-paper-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/${city}/stops/${encodeURIComponent(fav.stopId)}`} className="min-w-0 truncate text-sm font-bold hover:underline">
          {fav.name}
        </Link>
        <button type="button" onClick={onRemove} className="shrink-0 text-xs font-semibold text-ink-3 hover:text-brick">
          {t.favorites.remove}
        </button>
      </div>
      <div className="mt-2 text-xs text-ink-2">
        {board.isLoading ? <Spinner className="h-3 w-3" /> : null}
        {board.data ? (
          <ul className="flex flex-col gap-1">
            {board.data.rows.slice(0, 3).map((row) => (
              <li key={row.route.id} className="flex items-center gap-2">
                <RouteChip route={row.route} size="sm" />
                <span className="truncate">{cleanHeadsign(row.headsign) ?? cleanHeadsign(row.route.longName)}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1 tabular-nums">
                  {row.next
                    .slice(0, 3)
                    .map((n) => n.minutes)
                    .join(" · ")}{" "}
                  {t.common.min}
                  <FreshnessBadge freshness={board.data!.freshness} realtime={row.next[0]?.realtime ?? false} />
                </span>
              </li>
            ))}
            {!board.data.rows.length ? <li className="text-ink-3">{t.board.none}</li> : null}
          </ul>
        ) : board.error ? (
          <p className="text-ink-3">{t.board.none}</p>
        ) : null}
      </div>
    </li>
  );
}

function RouteCard({ fav, city, onRemove }: { fav: FavRoute; city: string; onRemove: () => void }) {
  const { t } = useI18n();
  const route = useRoute(city, fav.routeId);
  const svc = serviceStatus(t, route.data);
  return (
    <li className="flex items-center gap-3 rounded-card border border-line bg-paper-2 p-3">
      <Link href={`/${city}/routes/${encodeURIComponent(fav.routeId)}`} className="shrink-0">
        <RouteChip route={{ shortName: fav.shortName, color: fav.color, textColor: "", mode: "BUS" }} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/${city}/routes/${encodeURIComponent(fav.routeId)}`} className="block truncate text-sm font-bold hover:underline">
          {cleanHeadsign(fav.longName)}
        </Link>
        {svc.label ? <p className={`text-xs ${svc.active ? "text-moss" : "font-semibold text-brick"}`}>{svc.label}</p> : null}
      </div>
      <button type="button" onClick={onRemove} className="shrink-0 text-xs font-semibold text-ink-3 hover:text-brick">
        {t.favorites.remove}
      </button>
    </li>
  );
}
