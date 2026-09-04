"use client";

import { useEffect, useRef, useState } from "react";
import type { Vehicle } from "./api/types";

/**
 * Smooth vehicle motion between stream frames (Maas pattern). Each vehicle keeps
 * its previous and latest position; a requestAnimationFrame loop eases between
 * them over `durationMs`. Only vehicles inside `bbox` (or the first `cap`) are
 * animated; the rest are passed through untouched so a 6k-bus city stays cheap.
 */
type Track = { from: [number, number]; to: [number, number]; start: number };

export function useInterpolatedVehicles(
  vehicles: Vehicle[],
  opts: { enabled?: boolean; durationMs?: number; bbox?: [number, number, number, number] | null; cap?: number } = {},
): Vehicle[] {
  const { enabled = true, durationMs = 2500, bbox = null, cap = 500 } = opts;
  const tracks = useRef(new Map<string, Track>());
  const [out, setOut] = useState<Vehicle[]>(vehicles);
  const latest = useRef(vehicles);
  latest.current = vehicles;

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOut(vehicles);
      return;
    }
    const now = performance.now();
    const seen = new Set<string>();
    let animated = 0;
    for (const v of vehicles) {
      seen.add(v.id);
      const inView = !bbox || (v.lon >= bbox[0] && v.lon <= bbox[2] && v.lat >= bbox[1] && v.lat <= bbox[3]);
      if (!inView || animated >= cap) {
        tracks.current.delete(v.id);
        continue;
      }
      animated++;
      const tr = tracks.current.get(v.id);
      if (!tr) {
        tracks.current.set(v.id, { from: [v.lon, v.lat], to: [v.lon, v.lat], start: now });
      } else if (tr.to[0] !== v.lon || tr.to[1] !== v.lat) {
        const cur = position(tr, now, durationMs);
        tracks.current.set(v.id, { from: cur, to: [v.lon, v.lat], start: now });
      }
    }
    for (const id of [...tracks.current.keys()]) if (!seen.has(id)) tracks.current.delete(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles, enabled, bbox?.join(","), cap, durationMs]);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 100) return; // 10 fps is plenty for a map layer
      last = now;
      const vs = latest.current;
      let moving = false;
      const next = vs.map((v) => {
        const tr = tracks.current.get(v.id);
        if (!tr) return v;
        const p = position(tr, now, durationMs);
        if (now - tr.start < durationMs) moving = true;
        return p[0] === v.lon && p[1] === v.lat ? v : { ...v, lon: p[0], lat: p[1] };
      });
      if (moving) setOut(next);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, durationMs]);

  // whenever the source changes, at least reflect additions/removals immediately
  useEffect(() => {
    if (!enabled) return;
    setOut((prev) => {
      const now = performance.now();
      const prevById = new Map(prev.map((v) => [v.id, v]));
      return vehicles.map((v) => {
        const tr = tracks.current.get(v.id);
        if (!tr) return v;
        const p = position(tr, now, durationMs);
        const old = prevById.get(v.id);
        return { ...v, lon: p[0], lat: p[1], bearing: v.bearing ?? old?.bearing ?? null };
      });
    });
  }, [vehicles, enabled, durationMs]);

  return enabled ? out : vehicles;
}

function position(tr: Track, now: number, durationMs: number): [number, number] {
  const t = Math.min(1, (now - tr.start) / durationMs);
  const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in-out
  return [tr.from[0] + (tr.to[0] - tr.from[0]) * e, tr.from[1] + (tr.to[1] - tr.from[1]) * e];
}
