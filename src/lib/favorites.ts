"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Local-first favorites and recent trips (TransMi App + Maas patterns, merged):
 * typed places (Casa / Trabajo / custom), stops and routes, plus the last trips
 * for one-tap replanning. Stored per city in localStorage; the schema carries a
 * version so an optional sync layer can be added later without a migration dance.
 */

export type PlaceKind = "home" | "work" | "custom";

export type FavPlace = { kind: "place"; id: string; placeKind: PlaceKind; name: string; lat: number; lon: number; icon?: string };
export type FavStop = { kind: "stop"; id: string; stopId: string; name: string; component: string | null };
export type FavRoute = { kind: "route"; id: string; routeId: string; shortName: string; longName: string; color: string; component: string };
export type Favorite = FavPlace | FavStop | FavRoute;

export type RecentTrip = {
  id: string;
  from: { lat: number; lon: number; name: string | null };
  to: { lat: number; lon: number; name: string | null };
  at: number; // epoch ms
};

type Store = { v: 1; favorites: Favorite[]; recents: RecentTrip[] };

const EMPTY: Store = { v: 1, favorites: [], recents: [] };
const key = (city: string) => `opentransit.${city}.favorites`;
const listeners = new Set<() => void>();
const cache = new Map<string, Store>();

function read(city: string): Store {
  const c = cache.get(city);
  if (c) return c;
  let s: Store = EMPTY;
  try {
    const raw = localStorage.getItem(key(city));
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (parsed && parsed.v === 1) s = parsed;
    }
  } catch {
    /* storage unavailable or corrupt: behave as empty */
  }
  cache.set(city, s);
  return s;
}

function write(city: string, s: Store) {
  cache.set(city, s);
  try {
    localStorage.setItem(key(city), JSON.stringify(s));
  } catch {
    /* quota or private mode */
  }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = () => {
    cache.clear();
    l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
};

export function useFavorites(city: string) {
  const store = useSyncExternalStore(
    subscribe,
    () => read(city),
    () => EMPTY,
  );

  const toggle = useCallback(
    (f: Favorite) => {
      const s = read(city);
      const exists = s.favorites.some((x) => x.kind === f.kind && x.id === f.id);
      const favorites = exists ? s.favorites.filter((x) => !(x.kind === f.kind && x.id === f.id)) : [...s.favorites, f];
      write(city, { ...s, favorites });
    },
    [city],
  );

  const setPlace = useCallback(
    (placeKind: PlaceKind, p: { name: string; lat: number; lon: number; icon?: string; id?: string }) => {
      const s = read(city);
      const id = placeKind === "custom" ? (p.id ?? `custom-${Date.now()}`) : placeKind;
      const rest = s.favorites.filter((x) => !(x.kind === "place" && x.id === id));
      write(city, { ...s, favorites: [...rest, { kind: "place", id, placeKind, ...p }] });
    },
    [city],
  );

  const remove = useCallback(
    (kind: Favorite["kind"], id: string) => {
      const s = read(city);
      write(city, { ...s, favorites: s.favorites.filter((x) => !(x.kind === kind && x.id === id)) });
    },
    [city],
  );

  const addRecent = useCallback(
    (from: RecentTrip["from"], to: RecentTrip["to"]) => {
      const s = read(city);
      const id = `${from.lat.toFixed(4)},${from.lon.toFixed(4)}>${to.lat.toFixed(4)},${to.lon.toFixed(4)}`;
      const recents = [{ id, from, to, at: Date.now() }, ...s.recents.filter((r) => r.id !== id)].slice(0, 10);
      write(city, { ...s, recents });
    },
    [city],
  );

  const clearRecents = useCallback(() => write(city, { ...read(city), recents: [] }), [city]);

  const has = useCallback(
    (kind: Favorite["kind"], id: string) => store.favorites.some((x) => x.kind === kind && x.id === id),
    [store.favorites],
  );

  return {
    favorites: store.favorites,
    places: store.favorites.filter((f): f is FavPlace => f.kind === "place"),
    stops: store.favorites.filter((f): f is FavStop => f.kind === "stop"),
    routes: store.favorites.filter((f): f is FavRoute => f.kind === "route"),
    recents: store.recents,
    has,
    toggle,
    setPlace,
    remove,
    addRecent,
    clearRecents,
  };
}
