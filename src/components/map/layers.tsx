"use client";

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapMouseEvent } from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";
import { useMap } from "./MapView";
import { componentColor } from "@/lib/colors";
import { bboxOf, decodeGeometry, fc, normalizeHex, toLineString, toPoint, type LngLat } from "@/lib/geo";
import type { Geometry, Itinerary, NetworkShape, Stop, Vehicle } from "@/lib/api/types";
import type { FeatureCollection } from "geojson";

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
/** A layer spec without `source` — the hook wires the source id in. */
type LayerDef = DistributiveOmit<maplibregl.LayerSpecification, "source">;

/** Generic hook: keeps a GeoJSON source in sync and (re)creates layers after style loads. */
function useGeoJsonLayer(
  id: string,
  data: FeatureCollection,
  layers: LayerDef[],
  opts?: { before?: string; onClick?: (f: maplibregl.MapGeoJSONFeature) => void; clickLayers?: string[] },
) {
  const { map, styleVersion } = useMap();
  const onClickRef = useRef(opts?.onClick);
  onClickRef.current = opts?.onClick;

  useEffect(() => {
    // styleVersion > 0 means the style JSON has loaded (sprites/tiles may still be
    // in flight, which is fine for adding sources and layers).
    if (!map || styleVersion === 0) return;
    try {
      if (!map.getSource(id)) {
        map.addSource(id, { type: "geojson", data });
        for (const l of layers) {
          if (!map.getLayer(l.id)) {
            map.addLayer({ ...l, source: id } as maplibregl.LayerSpecification, opts?.before && map.getLayer(opts.before) ? opts.before : undefined);
          }
        }
      } else {
        (map.getSource(id) as GeoJSONSource).setData(data);
      }
    } catch (e) {
      console.warn(`[map] could not sync layer ${id}`, e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleVersion, data]);

  useEffect(() => {
    if (!map) return;
    const clickLayers = opts?.clickLayers ?? [];
    if (!clickLayers.length) return;
    const handler = (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (f) onClickRef.current?.(f);
    };
    const enter = () => (map.getCanvas().style.cursor = "pointer");
    const leave = () => (map.getCanvas().style.cursor = "");
    for (const l of clickLayers) {
      map.on("click", l, handler);
      map.on("mouseenter", l, enter);
      map.on("mouseleave", l, leave);
    }
    return () => {
      for (const l of clickLayers) {
        map.off("click", l, handler);
        map.off("mouseenter", l, enter);
        map.off("mouseleave", l, leave);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleVersion]);

  useEffect(() => {
    return () => {
      if (!map || !map.getStyle()) return;
      try {
        for (const l of layers) if (map.getLayer(l.id)) map.removeLayer(l.id);
        if (map.getSource(id)) map.removeSource(id);
      } catch {
        /* map already gone */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
}

// ── Itinerary ──────────────────────────────────────────────────────────────
export function ItineraryLayer({ itinerary, dim = false }: { itinerary: Itinerary | null; dim?: boolean }) {
  const data = useMemo(() => {
    if (!itinerary) return fc([]);
    const lines = itinerary.legs.map((leg, i) =>
      toLineString(decodeGeometry(leg.geometry), {
        i,
        walk: !leg.transit,
        color: leg.route ? normalizeHex(leg.route.color, componentColor(leg.route.component)) : "#667085",
      }),
    );
    const stops = itinerary.legs.flatMap((leg) =>
      leg.transit
        ? [leg.from, ...leg.intermediateStops, leg.to].map((p, j, arr) =>
            toPoint(p.lon, p.lat, {
              end: j === 0 || j === arr.length - 1,
              color: leg.route ? normalizeHex(leg.route.color, componentColor(leg.route.component)) : "#667085",
            }),
          )
        : [],
    );
    return fc([...lines, ...stops]);
  }, [itinerary]);

  useGeoJsonLayer("itinerary", data, [
    {
      id: "itinerary-casing",
      type: "line",
      filter: ["==", ["get", "walk"], false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": dim ? 0.4 : 0.9 },
    },
    {
      id: "itinerary-transit",
      type: "line",
      filter: ["==", ["get", "walk"], false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": 5, "line-opacity": dim ? 0.5 : 1 },
    },
    {
      id: "itinerary-walk",
      type: "line",
      filter: ["==", ["get", "walk"], true],
      layout: { "line-cap": "round" },
      paint: { "line-color": "#1a1d21", "line-width": 3, "line-dasharray": [0.2, 2], "line-opacity": dim ? 0.4 : 0.9 },
    },
    {
      id: "itinerary-stops",
      type: "circle",
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": ["case", ["get", "end"], 6, 3.5],
        "circle-color": "#ffffff",
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-width": ["case", ["get", "end"], 3, 2],
      },
    },
  ]);

  const bounds = useMemo(() => {
    if (!itinerary) return null;
    const coords: LngLat[] = itinerary.legs.flatMap((l) => decodeGeometry(l.geometry));
    return bboxOf(coords);
  }, [itinerary]);
  return <FitOnce bounds={bounds} />;
}

function FitOnce({ bounds }: { bounds: [number, number, number, number] | null }) {
  const { map } = useMap();
  useEffect(() => {
    if (!map || !bounds) return;
    const small = window.innerWidth < 768;
    map.fitBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      {
        padding: small ? { top: 80, bottom: 320, left: 30, right: 30 } : { top: 60, bottom: 60, left: 460, right: 60 },
        duration: 700,
        maxZoom: 15.5,
      },
    );
  }, [map, bounds]);
  return null;
}

// ── Single polyline (route pattern / vehicle shape) ─────────────────────────
export function LineLayer({ id, geometry, color, width = 4, fit = false }: { id: string; geometry: Geometry | null; color: string; width?: number; fit?: boolean }) {
  const coords = useMemo(() => decodeGeometry(geometry), [geometry]);
  const data = useMemo(() => fc(coords.length ? [toLineString(coords, { color })] : []), [coords, color]);
  useGeoJsonLayer(id, data, [
    { id: `${id}-casing`, type: "line", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": width + 4, "line-opacity": 0.8 } },
    { id: `${id}-line`, type: "line", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": width } },
  ]);
  const bounds = useMemo(() => (fit ? bboxOf(coords) : null), [coords, fit]);
  return fit ? <FitOnce bounds={bounds} /> : null;
}

// ── Network (all shapes, thin) ──────────────────────────────────────────────
export function NetworkLayer({ shapes, opacity = 0.35 }: { shapes: NetworkShape[]; opacity?: number }) {
  const data = useMemo(
    () => fc(shapes.map((s) => toLineString(decodeGeometry(s.geometry), { color: normalizeHex(s.color, componentColor(s.component)), c: s.component }))),
    [shapes],
  );
  useGeoJsonLayer("network", data, [
    { id: "network-line", type: "line", layout: { "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 14, 2.5], "line-opacity": opacity } },
  ]);
  return null;
}

// ── Stops ───────────────────────────────────────────────────────────────────
export function StopsLayer({ stops, onClick, id = "stops" }: { stops: Stop[]; onClick?: (s: Stop) => void; id?: string }) {
  const byId = useMemo(() => new Map(stops.map((s) => [s.id, s])), [stops]);
  const data = useMemo(
    () =>
      fc(
        stops.map((s) =>
          toPoint(s.lon, s.lat, {
            id: s.id,
            name: s.name,
            station: s.locationType === "station",
            color: componentColor(s.component),
          }),
        ),
      ),
    [stops],
  );
  useGeoJsonLayer(
    id,
    data,
    [
      {
        id: `${id}-circle`,
        type: "circle",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, ["case", ["get", "station"], 4, 2], 15, ["case", ["get", "station"], 8, 5]],
          "circle-color": "#ffffff",
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": ["case", ["get", "station"], 3, 2],
        },
      },
      {
        id: `${id}-label`,
        type: "symbol",
        minzoom: 13.5,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 1.1],
          "text-anchor": "top",
          "text-font": ["Noto Sans Regular"],
          "text-optional": true,
        },
        paint: { "text-color": "#1a1d21", "text-halo-color": "#ffffff", "text-halo-width": 1.2 },
      },
    ],
    {
      clickLayers: [`${id}-circle`],
      onClick: (f) => {
        const s = byId.get(String(f.properties?.id));
        if (s) onClick?.(s);
      },
    },
  );
  return null;
}

// ── Vehicles ────────────────────────────────────────────────────────────────
export function VehiclesLayer({ vehicles, onClick, selectedId }: { vehicles: Vehicle[]; onClick?: (v: Vehicle) => void; selectedId?: string | null }) {
  const byId = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const data = useMemo(
    () =>
      fc(
        vehicles.map((v) =>
          toPoint(v.lon, v.lat, {
            id: v.id,
            label: v.routeShortName ?? "",
            color: componentColor(v.component),
            resolved: v.tripResolved,
            selected: v.id === selectedId,
          }),
        ),
      ),
    [vehicles, selectedId],
  );
  useGeoJsonLayer(
    "vehicles",
    data,
    [
      {
        id: "vehicles-circle",
        type: "circle",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 14, 6, 17, 9],
          "circle-color": ["get", "color"],
          "circle-opacity": ["case", ["get", "resolved"], 1, 0.6],
          "circle-stroke-color": ["case", ["get", "selected"], "#f2b41b", "#ffffff"],
          "circle-stroke-width": ["case", ["get", "selected"], 4, 1.5],
        },
      },
      {
        id: "vehicles-label",
        type: "symbol",
        minzoom: 14,
        layout: {
          "text-field": ["get", "label"],
          "text-size": 10,
          "text-offset": [0, -1.2],
          "text-font": ["Noto Sans Bold"],
          "text-allow-overlap": false,
          "text-optional": true,
        },
        paint: { "text-color": ["get", "color"], "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
      },
    ],
    {
      clickLayers: ["vehicles-circle"],
      onClick: (f) => {
        const v = byId.get(String(f.properties?.id));
        if (v) onClick?.(v);
      },
    },
  );
  return null;
}

// ── Pins (origin/destination/user) as DOM markers ───────────────────────────
export function PinMarker({ lat, lon, kind }: { lat: number; lon: number; kind: "from" | "to" | "user" }) {
  const { map } = useMap();
  useEffect(() => {
    if (!map) return;
    const el = document.createElement("div");
    if (kind === "user") {
      el.className = "h-4 w-4 rounded-full border-[3px] border-white bg-signal shadow";
    } else {
      el.className = "pin";
      el.style.background = kind === "from" ? "#1a1d21" : "#0b5cd5";
    }
    const marker = new maplibregl.Marker({ element: el, anchor: kind === "user" ? "center" : "bottom-left", offset: kind === "user" ? [0, 0] : [0, 0] })
      .setLngLat([lon, lat])
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, lat, lon, kind]);
  return null;
}
