"use client";

import * as maplibregl from "maplibre-gl";
import type { LngLatBoundsLike, Map as MLMap, MapMouseEvent } from "maplibre-gl";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTheme } from "@/lib/theme";

export const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
export const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

// MapLibre ≥ 6 loads its worker relative to import.meta.url, which the bundler
// rewrites; serve the worker from public/ instead (see scripts/copy-maplibre-worker.mjs).
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
}

type MapCtx = { map: MLMap | null; styleVersion: number };
const Ctx = createContext<MapCtx>({ map: null, styleVersion: 0 });

/** Map instance + a counter that bumps every time the style (re)loads, so layers re-add themselves. */
export function useMap() {
  return useContext(Ctx);
}

type Props = {
  center: [number, number]; // lon, lat
  zoom: number;
  bounds?: LngLatBoundsLike;
  maxBounds?: LngLatBoundsLike;
  attribution?: string;
  onClick?: (lngLat: { lng: number; lat: number }) => void;
  className?: string;
  children?: ReactNode;
  padding?: { top: number; bottom: number; left: number; right: number };
};

export function MapView({
  center,
  zoom,
  maxBounds,
  attribution,
  onClick,
  className = "",
  children,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MLMap | null>(null);
  const [styleVersion, setStyleVersion] = useState(0);
  const { resolved } = useTheme();
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: document.documentElement.dataset.theme === "dark" ? STYLE_DARK : STYLE_LIGHT,
      center,
      zoom,
      maxBounds,
      attributionControl: false,
      cooperativeGestures: false,
    });
    m.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: attribution,
      }),
      "bottom-right",
    );
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    m.on("style.load", () => setStyleVersion((v) => v + 1));
    m.on("click", (e: MapMouseEvent) => onClickRef.current?.(e.lngLat));
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __otMap?: MLMap }).__otMap = m; // handy in devtools
    }
    setMap(m);
    return () => {
      m.remove();
      setMap(null);
    };
    // Initial view only; subsequent moves are driven by children via useMap().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme switch → swap basemap style. Layers re-add on style.load via styleVersion.
  useEffect(() => {
    if (!map) return;
    const want = resolved === "dark" ? STYLE_DARK : STYLE_LIGHT;
    const current = (map.getStyle() as { name?: string } | undefined)?.name ?? "";
    const isDark = /dark/i.test(current);
    if ((resolved === "dark") !== isDark) map.setStyle(want);
  }, [map, resolved]);

  return (
    <div className={`relative ${className}`}>
      <div ref={el} className="absolute inset-0" aria-label="Mapa" role="application" />
      <Ctx.Provider value={{ map, styleVersion }}>{map ? children : null}</Ctx.Provider>
    </div>
  );
}

export function useFitBounds(
  bounds: [number, number, number, number] | null,
  padding: { top: number; bottom: number; left: number; right: number } | number = 60,
  deps: unknown[] = [],
) {
  const { map } = useMap();
  useEffect(() => {
    if (!map || !bounds) return;
    const [minLon, minLat, maxLon, maxLat] = bounds;
    if (minLon === maxLon && minLat === maxLat) {
      const small = window.innerWidth < 768;
      map.easeTo({
        center: [minLon, minLat],
        zoom: 15,
        duration: 500,
        padding: small ? { top: 60, bottom: Math.round(window.innerHeight * 0.6), left: 0, right: 0 } : { top: 0, bottom: 0, left: 440, right: 0 },
      });
      return;
    }
    map.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      { padding, duration: 600, maxZoom: 16 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, bounds?.join(","), ...deps]);
}
