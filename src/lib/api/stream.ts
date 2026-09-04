"use client";

import { useEffect, useRef, useState } from "react";
import { MOCK, api } from "./client";
import type { Vehicle, VehicleEvent, VehicleFrame, VehicleHealth } from "./types";

export type VehicleStreamState = {
  vehicles: Map<string, Vehicle>;
  seq: number;
  generatedAt: string | null;
  health: VehicleHealth | null;
  status: "connecting" | "live" | "reconnecting" | "off";
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
 * Subscribes to the city's SSE vehicle stream. The first event is a full frame,
 * subsequent events are deltas. Reconnects with backoff; falls back to polling
 * the snapshot endpoint if EventSource is unavailable.
 */
export function useVehicleStream(city: string, enabled = true): VehicleStreamState {
  const [state, setState] = useState<VehicleStreamState>(initial);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!enabled) {
      setState({ ...initial(), status: "off" });
      return;
    }
    let cancelled = false;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let backoff = 1000;

    const push = (ev: VehicleEvent) => {
      if (cancelled) return;
      setState((prev) => applyEvent(prev, ev));
      backoff = 1000;
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

    const connect = () => {
      if (cancelled) return;
      if (typeof EventSource === "undefined") {
        // Polling fallback
        const poll = async () => {
          try {
            const frame: VehicleFrame = await api.vehicles(city);
            push(frame);
          } catch {
            setState((p) => ({ ...p, status: "reconnecting" }));
          }
          timer = setTimeout(poll, 15_000);
        };
        poll();
        return;
      }
      es = new EventSource(api.vehicleStreamUrl(city));
      es.onmessage = (m) => {
        try {
          push(JSON.parse(m.data) as VehicleEvent);
        } catch {
          /* ignore malformed frame */
        }
      };
      es.onerror = () => {
        es?.close();
        es = null;
        setState((p) => ({ ...p, status: "reconnecting" }));
        timer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30_000);
      };
    };
    connect();

    return () => {
      cancelled = true;
      es?.close();
      if (timer) clearTimeout(timer);
    };
  }, [city, enabled]);

  return state;
}
