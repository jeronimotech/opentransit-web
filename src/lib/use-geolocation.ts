"use client";

import { useCallback, useEffect, useState } from "react";

export type GeoState = {
  pos: { lat: number; lon: number } | null;
  error: string | null;
  loading: boolean;
};

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ pos: null, error: null, loading: false });

  const locate = useCallback((): Promise<{ lat: number; lon: number } | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, error: "unsupported" }));
      return Promise.resolve(null);
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const pos = { lat: p.coords.latitude, lon: p.coords.longitude };
          setState({ pos, error: null, loading: false });
          resolve(pos);
        },
        (e) => {
          setState({ pos: null, error: e.message || "denied", loading: false });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
      );
    });
  }, []);

  return { ...state, locate };
}

export type WatchState = {
  pos: { lat: number; lon: number } | null;
  /** null while we have never had a fix; "denied" | "unsupported" | a browser message. */
  error: string | null;
  accuracy: number | null;
};

/**
 * Continuous foreground position for the follow-me camera. Stops the watch when
 * `active` goes false or the component unmounts — no background tracking.
 */
export function useWatchPosition(active: boolean): WatchState {
  const [state, setState] = useState<WatchState>({ pos: null, error: null, accuracy: null });

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ pos: null, error: "unsupported", accuracy: null });
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) =>
        setState({
          pos: { lat: p.coords.latitude, lon: p.coords.longitude },
          error: null,
          accuracy: p.coords.accuracy ?? null,
        }),
      (e) => setState((s) => ({ ...s, error: e.code === e.PERMISSION_DENIED ? "denied" : e.message || "error" })),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active]);

  return state;
}
