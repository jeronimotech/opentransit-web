"use client";

import { useCallback, useState } from "react";

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
