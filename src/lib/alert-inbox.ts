"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Alert } from "./api/types";

/**
 * Home "mensajes de interés" (TransMi App pattern): each alert is shown at most
 * MAX_IMPRESSIONS times and can be dismissed for good. Purely local.
 */
export const MAX_IMPRESSIONS = 3;
const key = (city: string) => `opentransit.${city}.alertInbox`;
type State = { v: 1; dismissed: Record<string, number>; impressions: Record<string, number> };
const EMPTY: State = { v: 1, dismissed: {}, impressions: {} };
const cache = new Map<string, State>();
const listeners = new Set<() => void>();

function read(city: string): State {
  const c = cache.get(city);
  if (c) return c;
  let s = EMPTY;
  try {
    const raw = localStorage.getItem(key(city));
    if (raw) s = { ...EMPTY, ...(JSON.parse(raw) as State) };
  } catch {
    /* empty */
  }
  cache.set(city, s);
  return s;
}
function write(city: string, s: State) {
  cache.set(city, s);
  try {
    localStorage.setItem(key(city), JSON.stringify(s));
  } catch {
    /* ignore */
  }
  for (const l of listeners) l();
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const ORDER = { SEVERE: 0, WARNING: 1, INFO: 2 } as const;

export function useAlertInbox(city: string, alerts: Alert[], limit = 5) {
  const state = useSyncExternalStore(subscribe, () => read(city), () => EMPTY);

  const visible = [...alerts]
    .filter((a) => !state.dismissed[a.id] && (state.impressions[a.id] ?? 0) < MAX_IMPRESSIONS)
    .sort((a, b) => (ORDER[a.severity ?? "INFO"] ?? 2) - (ORDER[b.severity ?? "INFO"] ?? 2))
    .slice(0, limit);

  const dismiss = useCallback(
    (id: string) => {
      const s = read(city);
      write(city, { ...s, dismissed: { ...s.dismissed, [id]: Date.now() } });
    },
    [city],
  );

  /** Call once per page view for the alerts actually rendered. */
  const markShown = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      const s = read(city);
      const impressions = { ...s.impressions };
      for (const id of ids) impressions[id] = (impressions[id] ?? 0) + 1;
      // don't broadcast: counting impressions must not re-render the carousel away
      cache.set(city, { ...s, impressions });
      try {
        localStorage.setItem(key(city), JSON.stringify({ ...s, impressions }));
      } catch {
        /* ignore */
      }
    },
    [city],
  );

  return { visible, dismiss, markShown };
}
