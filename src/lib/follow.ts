"use client";

import { useEffect, useRef, useState } from "react";
import { decodeGeometry, haversineMeters, type LngLat } from "./geo";
import type { Itinerary } from "./api/types";

/**
 * "Iniciar viaje" follow-along (TransMi App idea, web version): watch the device
 * position, snap it to the nearest leg geometry, and report the current leg index,
 * progress along it and distance to the leg's end. No notifications on web.
 */
export type FollowState = {
  active: boolean;
  legIndex: number | null;
  progress: number; // 0..1 along the current leg
  metersToLegEnd: number | null;
  metersOff: number | null; // distance from the route
  pos: { lat: number; lon: number } | null;
  error: string | null;
};

const IDLE: FollowState = { active: false, legIndex: null, progress: 0, metersToLegEnd: null, metersOff: null, pos: null, error: null };

export function useFollowAlong(itinerary: Itinerary | null, active: boolean): FollowState {
  const [state, setState] = useState<FollowState>(IDLE);
  const watch = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !itinerary) {
      setState(IDLE);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ ...IDLE, active: true, error: "unsupported" });
      return;
    }
    const legs = itinerary.legs.map((l) => decodeGeometry(l.geometry));
    setState({ ...IDLE, active: true });
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lon: p.coords.longitude };
        let best = { leg: -1, idx: 0, d: Infinity };
        legs.forEach((coords, li) => {
          coords.forEach((c, i) => {
            const d = haversineMeters(pos, { lat: c[1], lon: c[0] });
            if (d < best.d) best = { leg: li, idx: i, d };
          });
        });
        if (best.leg < 0) return;
        const coords = legs[best.leg];
        const total = lengthOf(coords);
        const done = lengthOf(coords.slice(0, best.idx + 1));
        setState({
          active: true,
          legIndex: best.leg,
          progress: total > 0 ? Math.min(1, done / total) : 0,
          metersToLegEnd: Math.max(0, Math.round(total - done)),
          metersOff: Math.round(best.d),
          pos,
          error: null,
        });
      },
      (e) => setState((s) => ({ ...s, active: true, error: e.message || "denied" })),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );
    return () => {
      if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
    };
  }, [active, itinerary]);

  return state;
}

function lengthOf(coords: LngLat[]): number {
  let m = 0;
  for (let i = 1; i < coords.length; i++) {
    m += haversineMeters({ lat: coords[i - 1][1], lon: coords[i - 1][0] }, { lat: coords[i][1], lon: coords[i][0] });
  }
  return m;
}
