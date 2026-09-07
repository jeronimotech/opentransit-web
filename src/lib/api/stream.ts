"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MOCK, api } from "./client";
import type { Vehicle, VehicleEvent, VehicleFrame, VehicleHealth } from "./types";

export type VehicleStreamState = {
  vehicles: Map<string, Vehicle>;
  seq: number;
  generatedAt: string | null;
  health: VehicleHealth | null;
  status: "connecting" | "live" | "reconnecting" | "off";
};

/** Server-side filters. Narrowing the bbox is what keeps "Cerca de mí" cheap. */
export type StreamFilters = { bbox?: string | null; routeIds?: string[] | null };

export type StreamOptions = {
  filters?: StreamFilters;
  /** Close the connection while the tab is hidden and reopen on return (battery). */
  pauseWhenHidden?: boolean;
};

const initial = (): VehicleStreamState => ({
  vehicles: new Map(),
  seq: 0,
  generatedAt: null,
  health: null,
  status: "connecting",
});

/** Apply a full frame or a delta to the current map (immutably). */
export function applyEvent(prev: VehicleStreamState, ev: VehicleEvent): VehicleStreamState {
  const vehicles = ev.type === "full" ? new Map<string, Vehicle>() : new Map(prev.vehicles);
  if (ev.type === "full") {
    for (const v of ev.vehicles) vehicles.set(v.id, v);
  } else {
    for (const v of ev.updated) {
      const old = vehicles.get(v.id);
      vehicles.set(v.id, old ? { ...old, ...v } : v);
    }
    for (const id of ev.removed) vehicles.delete(id);
  }
  return {
    vehicles,
    seq: ev.seq,
    generatedAt: ev.generatedAt,
    health: ev.health,
    status: "live",
  };
}

/**
 * Identity of a subscription. The effect keys off this string, so a changed bbox
 * or route filter tears the old connection down and opens a new one, rather than
 * filtering a city-wide firehose on the client.
 */
export function subscriptionKey(city: string, f?: StreamFilters): string {
  return [city, f?.bbox ?? "", (f?.routeIds ?? []).join(",")].join("|");
}

/** Connect only when the caller wants it and the tab is actually being looked at. */
export function shouldConnect(enabled: boolean, hidden: boolean, pauseWhenHidden: boolean): boolean {
  return enabled && !(pauseWhenHidden && hidden);
}

/** The bits of EventSource this module uses; lets the tests inject a fake. */
export type SourceLike = {
  close(): void;
  onmessage: ((e: { data: string }) => void) | null;
  onerror: ((e?: unknown) => void) | null;
};

export type Subscription = { close: () => void };

/**
 * Opens one SSE subscription and reconnects with backoff. Returned handle closes
 * the socket and cancels any pending retry — leaving the page must not leave a
 * connection (or a timer) behind.
 */
export function createVehicleSubscription(opts: {
  url: string;
  createSource: (url: string) => SourceLike;
  onEvent: (ev: VehicleEvent) => void;
  onStatus: (s: VehicleStreamState["status"]) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
  maxBackoffMs?: number;
}): Subscription {
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const maxBackoff = opts.maxBackoffMs ?? 30_000;

  let closed = false;
  let source: SourceLike | null = null;
  let timer: unknown = null;
  let backoff = 1000;

  const connect = () => {
    if (closed) return;
    const es = opts.createSource(opts.url);
    source = es;
    es.onmessage = (m) => {
      if (closed) return;
      try {
        opts.onEvent(JSON.parse(m.data) as VehicleEvent);
        backoff = 1000;
      } catch {
        /* ignore a malformed frame rather than tearing the stream down */
      }
    };
    es.onerror = () => {
      if (closed) return;
      es.close();
      if (source === es) source = null;
      opts.onStatus("reconnecting");
      timer = setTimer(connect, backoff);
      backoff = Math.min(backoff * 2, maxBackoff);
    };
  };

  connect();

  return {
    close() {
      if (closed) return;
      closed = true;
      source?.close();
      source = null;
      if (timer != null) clearTimer(timer);
      timer = null;
    },
  };
}

/** Subscribes to `document.visibilitychange`; returns the current hidden state. */
function useDocumentHidden(active: boolean): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const read = () => setHidden(document.hidden);
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, [active]);
  return active ? hidden : false;
}

/**
 * Subscribes to the city's SSE vehicle stream. The first event is a full frame,
 * subsequent events are deltas. Reconnects with backoff; falls back to polling
 * the snapshot endpoint if EventSource is unavailable.
 */
export function useVehicleStream(city: string, enabled = true, options?: StreamOptions): VehicleStreamState {
  const [state, setState] = useState<VehicleStreamState>(initial);
  const pauseWhenHidden = options?.pauseWhenHidden ?? false;
  const hidden = useDocumentHidden(pauseWhenHidden);
  const filters = options?.filters;
  const key = useMemo(() => subscriptionKey(city, filters), [city, filters?.bbox, filters?.routeIds?.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Read the latest filters inside the effect without making them a dependency:
  // the key above is the identity that decides when to re-subscribe.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const connectWanted = shouldConnect(enabled, hidden, pauseWhenHidden);

  useEffect(() => {
    if (!connectWanted) {
      setState((p) => ({ ...p, status: "off" }));
      return;
    }
    let cancelled = false;
    const f = filtersRef.current;
    // A new subscription starts from a fresh full frame; keeping the old vehicles
    // would show buses from the previous bbox until they happened to be removed.
    setState({ ...initial(), status: "connecting" });

    const push = (ev: VehicleEvent) => {
      if (cancelled) return;
      setState((prev) => applyEvent(prev, ev));
    };

    if (MOCK) {
      let stop: (() => void) | null = null;
      import("@/mocks/handlers").then(({ mockVehicleStream }) => {
        if (cancelled) return;
        stop = mockVehicleStream(city, push);
      });
      return () => {
        cancelled = true;
        stop?.();
      };
    }

    if (typeof EventSource === "undefined") {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const poll = async () => {
        try {
          const frame: VehicleFrame = await api.vehicles(city, { bbox: f?.bbox ?? undefined });
          push(frame);
        } catch {
          if (!cancelled) setState((p) => ({ ...p, status: "reconnecting" }));
        }
        if (!cancelled) timer = setTimeout(poll, 15_000);
      };
      poll();
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }

    const sub = createVehicleSubscription({
      url: api.vehicleStreamUrl(city, { bbox: f?.bbox ?? undefined, routeIds: f?.routeIds ?? undefined }),
      createSource: (url) => new EventSource(url) as unknown as SourceLike,
      onEvent: push,
      onStatus: (s) => {
        if (!cancelled) setState((p) => ({ ...p, status: s }));
      },
    });

    return () => {
      cancelled = true;
      sub.close();
    };
  }, [key, connectWanted, city]);

  return state;
}
