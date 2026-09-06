"use client";

import { useMemo, useState } from "react";
import { MapView, useFitBounds } from "@/components/map/MapView";
import { useGeoJsonLayer } from "@/components/map/layers";
import type { AnalyticsOdResponse, City } from "@/lib/api/types";
import type { FeatureCollection } from "geojson";

export type OdKind = "origins" | "destinations" | "searches";

/**
 * Cell heat layer (sequential hue, k ≥ 5 cells only) + the top O-D pairs as arcs.
 * Colour follows magnitude only; hovering a cell shows its count.
 */
function CellsLayer({ data, kind, onHover }: { data: AnalyticsOdResponse; kind: OdKind; onHover: (v: number | null) => void }) {
  const max = useMemo(() => Math.max(1, ...data.cells.features.map((f) => f.properties[kind])), [data, kind]);
  // ~150 m cells are specks at city zoom: draw each cell as a circle whose area follows the count
  // (sequential hue for the same magnitude), and the cell outline only once zoomed in.
  const fc = useMemo<FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: data.cells.features
      .filter((f) => f.properties[kind] >= data.kThreshold)
      .map((f) => {
        const ring = f.geometry.coordinates[0];
        const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length, cy = ring.reduce((a, p) => a + p[1], 0) / ring.length;
        const v = f.properties[kind] / max;
        return { type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [cx, cy] }, properties: { ...f.properties, v, r: 4 + Math.sqrt(v) * 18 } };
      }),
  }), [data, kind, max]);
  useGeoJsonLayer(
    "an-cells",
    fc,
    [
      { id: "an-cells-fill", type: "circle", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, ["*", ["get", "r"], 0.6], 14, ["get", "r"]], "circle-color": ["interpolate", ["linear"], ["get", "v"], 0, "#b7cff0", 0.35, "#6d9ddf", 0.7, "#2f6fc4", 1, "#17427c"], "circle-opacity": 0.78, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 } },
    ] as never,
    { onClick: (f) => onHover((f.properties as { [k: string]: number })[kind] ?? null), clickLayers: ["an-cells-fill"] },
  );
  return null;
}

function ArcsLayer({ data }: { data: AnalyticsOdResponse }) {
  const max = useMemo(() => Math.max(1, ...data.pairs.map((p) => p.n)), [data]);
  const fc = useMemo<FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: data.pairs.map((p) => {
      // a gentle curve so overlapping corridors stay legible
      const [x1, y1] = p.fromCenter, [x2, y2] = p.toCenter;
      const mx = (x1 + x2) / 2 + (y2 - y1) * 0.18, my = (y1 + y2) / 2 - (x2 - x1) * 0.18;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        pts.push([(1 - t) ** 2 * x1 + 2 * (1 - t) * t * mx + t ** 2 * x2, (1 - t) ** 2 * y1 + 2 * (1 - t) * t * my + t ** 2 * y2]);
      }
      return { type: "Feature", geometry: { type: "LineString", coordinates: pts }, properties: { n: p.n, w: 1 + (p.n / max) * 3 } };
    }),
  }), [data, max]);
  useGeoJsonLayer("an-arcs", fc, [
    { id: "an-arcs-casing", type: "line", layout: { "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": ["+", ["get", "w"], 1.5], "line-opacity": 0.6 } },
    { id: "an-arcs-line", type: "line", layout: { "line-cap": "round" }, paint: { "line-color": "#eb6834", "line-width": ["get", "w"], "line-opacity": 0.8 } },
  ] as never);
  return null;
}

function Fit({ data }: { data: AnalyticsOdResponse }) {
  const bounds = useMemo(() => {
    const xs: number[] = [], ys: number[] = [];
    for (const f of data.cells.features) for (const ring of f.geometry.coordinates) for (const [x, y] of ring) { xs.push(x); ys.push(y); }
    return xs.length ? ([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number]) : null;
  }, [data]);
  useFitBounds(bounds, { top: 30, bottom: 30, left: 30, right: 30 });
  return null;
}

export function AnalyticsMap({ city, data, kind, arcs, attribution }: { city: City; data: AnalyticsOdResponse | null; kind: OdKind; arcs: boolean; attribution: string }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="relative h-[420px] overflow-hidden rounded-card border border-line" data-testid="analytics-map">
      <MapView center={[city.center.lon, city.center.lat]} zoom={city.defaultZoom} attribution={attribution} className="h-full w-full">
        {data ? <CellsLayer data={data} kind={kind} onHover={setHover} /> : null}
        {data && arcs ? <ArcsLayer data={data} /> : null}
        {data ? <Fit data={data} /> : null}
      </MapView>
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-md border border-line bg-paper-2/95 px-2 py-1 text-[11px] text-ink-2 shadow-card">
        <span className="h-2.5 w-16 rounded-sm" style={{ background: "linear-gradient(90deg,#b7cff0,#6d9ddf,#2f6fc4,#17427c)" }} aria-hidden />
        <span>−</span>
        <span>+</span>
        {hover !== null ? <span className="ml-2 font-semibold text-ink tabular-nums">{hover}</span> : null}
      </div>
    </div>
  );
}
