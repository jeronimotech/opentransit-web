"use client";

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapMouseEvent } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMap, useMapZoom } from "./MapView";
import { componentColor } from "@/lib/colors";
import { desaturate, routeChipColors } from "@/lib/route-color";
import { LIVE_DETAIL_ZOOM, LIVE_MIN_ZOOM } from "@/lib/marker-style";
import { ETA_COLORS, etaBucket } from "@/lib/eta";
import { bboxOf, decodeGeometry, fc, toLineString, toPoint, type BBox, type LngLat } from "@/lib/geo";
import type { BikeShareNetwork, Component, Geometry, Itinerary, NetworkShape, PoiCollection, PoiType, RentalStation, Stop, Vehicle } from "@/lib/api/types";
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
        walk: !leg.transit && !leg.rental,
        // shared-vehicle legs: dashed line in the network's colour
        rental: !!leg.rental,
        color: leg.rental ? leg.rental.color : leg.route ? routeChipColors(leg.route.color, componentColor(leg.route.component)).bg : "#667085",
      }),
    );
    const stops = itinerary.legs.flatMap((leg) =>
      leg.transit
        ? [leg.from, ...leg.intermediateStops, leg.to].map((p, j, arr) =>
            toPoint(p.lon, p.lat, {
              end: j === 0 || j === arr.length - 1,
              color: leg.route ? routeChipColors(leg.route.color, componentColor(leg.route.component)).bg : "#667085",
            }),
          )
        : leg.rental
          ? [leg.from, leg.to].map((p) => toPoint(p.lon, p.lat, { end: true, color: leg.rental!.color, rentalPt: true }))
          : [],
    );
    return fc([...lines, ...stops]);
  }, [itinerary]);

  useGeoJsonLayer("itinerary", data, [
    {
      id: "itinerary-casing",
      type: "line",
      filter: ["all", ["==", ["get", "walk"], false], ["!=", ["get", "rental"], true]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": dim ? 0.4 : 0.9 },
    },
    {
      id: "itinerary-transit",
      type: "line",
      filter: ["all", ["==", ["get", "walk"], false], ["!=", ["get", "rental"], true]],
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
      id: "itinerary-rental-casing",
      type: "line",
      filter: ["==", ["get", "rental"], true],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": dim ? 0.4 : 0.9 },
    },
    {
      id: "itinerary-rental",
      type: "line",
      filter: ["==", ["get", "rental"], true],
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": 4.5, "line-dasharray": [1.6, 1.1], "line-opacity": dim ? 0.5 : 1 },
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
/**
 * Every route shape as a quiet backdrop. Feeds ship neon colours and hundreds of
 * overlapping shapes on the same corridor, so lines use the desaturated component
 * colour, stay ≤ 2 px and sit well below the labels.
 */
export const NETWORK_GROUPS = {
  /** "Red troncal": the backbone (BRT + cable). ON by default. */
  trunk: { components: ["trunk", "cable", "rail"] as Component[], width: 2.5, opacity: 0.5 },
  /** "Rutas zonales": zonal + dual + feeder — hundreds of overlapping shapes, OFF by default. */
  zonal: { components: ["zonal", "dual", "feeder", "other"] as Component[], width: 1.5, opacity: 0.18 },
};

export function NetworkLayer({ shapes, group = "trunk" }: { shapes: NetworkShape[]; group?: keyof typeof NETWORK_GROUPS }) {
  const g = NETWORK_GROUPS[group];
  const data = useMemo(
    () =>
      fc(
        shapes
          .filter((s) => g.components.includes(s.component))
          .map((s) => toLineString(decodeGeometry(s.geometry), { color: desaturate(routeChipColors(s.color, componentColor(s.component)).bg, 0.3), c: s.component })),
      ),
    [shapes, g],
  );
  useGeoJsonLayer(
    `network-${group}`,
    data,
    [
      {
        id: `network-${group}-line`,
        type: "line",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, g.width * 0.4, 14, g.width * 0.7, 17, g.width],
          // fades in with zoom: at city scale a thousand shapes would otherwise cover the basemap
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 11, g.opacity * 0.5, 14, g.opacity],
        },
      },
    ],
    { before: "waterway_name" },
  );
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
          // < 15: 4 px dots (2 px radius, thin ring, no label); ≥ 15: full markers
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, ["case", ["get", "station"], 2.5, 1.5], 14.9, ["case", ["get", "station"], 3, 2], 15, ["case", ["get", "station"], 8, 5]],
          "circle-color": "#ffffff",
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": ["step", ["zoom"], ["case", ["get", "station"], 1.5, 1], 15, ["case", ["get", "station"], 3, 2]],
        },
      },
      {
        id: `${id}-label`,
        type: "symbol",
        minzoom: 15,
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
/**
 * Fleet markers with the UX-audit zoom rules:
 *   · below zoom 14 the fleet is hidden — only "highlighted" vehicles stay (a selected
 *     route, the buses heading to a selected stop, the itinerary's routes);
 *   · 14–16: 6 px dots at 70 % opacity; ≥ 16: 10 px dots with a bearing tick;
 *   · component colours are desaturated 20 % so the base map stays readable;
 *     highlighted / ETA-tinted markers keep full colour and size.
 * `etaById` (a stop is selected) tints the fill by ETA bucket (≤5 / ≤10 / ≤15 min).
 * Pass already-interpolated positions for motion.
 */
export function VehiclesLayer({
  vehicles,
  onClick,
  selectedId,
  etaById,
  colors,
  dimOthers = false,
  highlightRouteIds,
  focus = false,
}: {
  vehicles: Vehicle[];
  onClick?: (v: Vehicle) => void;
  selectedId?: string | null;
  etaById?: Map<string, number> | null;
  colors?: Partial<Record<string, string>>;
  dimOthers?: boolean;
  /** Routes whose vehicles are always drawn at full size/opacity, at any zoom. */
  highlightRouteIds?: Set<string> | null;
  /** Focus context (stop, next-buses, itinerary): every vehicle passed in is highlighted. */
  focus?: boolean;
}) {
  const byId = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const data = useMemo(
    () =>
      fc(
        vehicles.map((v) => {
          const comp = colors?.[v.component] ?? componentColor(v.component);
          const eta = etaById?.get(v.id);
          const bucket = etaBucket(eta ?? null);
          const tinted = etaById ? bucket !== "none" : false;
          const hl = focus || tinted || v.id === selectedId || (!!v.routeId && !!highlightRouteIds?.has(v.routeId));
          return toPoint(v.lon, v.lat, {
            id: v.id,
            label: eta != null ? `${v.routeShortName ?? ""} · ${eta} min` : (v.routeShortName ?? ""),
            color: tinted ? ETA_COLORS[bucket] : hl ? comp : desaturate(comp, 0.2),
            ring: tinted ? comp : "#ffffff",
            resolved: v.tripResolved,
            selected: v.id === selectedId,
            tinted,
            hl,
            hasBearing: v.bearing != null,
            bearing: v.bearing ?? 0,
            dim: dimOthers && etaById != null && !tinted,
          });
        }),
      ),
    [vehicles, selectedId, etaById, colors, dimOthers, highlightRouteIds, focus],
  );
  const circlePaint = (hlLayer: boolean): maplibregl.CircleLayerSpecification["paint"] => ({
    "circle-radius": hlLayer
      ? ["interpolate", ["linear"], ["zoom"], 10, ["case", ["get", "tinted"], 5, 4], 14, ["case", ["get", "tinted"], 8, 6], 17, ["case", ["get", "tinted"], 11, 9]]
      : ["interpolate", ["linear"], ["zoom"], LIVE_MIN_ZOOM, 3, LIVE_DETAIL_ZOOM, 5, 18, 7],
    "circle-color": ["get", "color"],
    "circle-opacity": hlLayer
      ? ["case", ["get", "dim"], 0.25, ["get", "resolved"], 1, 0.7]
      : ["step", ["zoom"], 0.7, LIVE_DETAIL_ZOOM, 0.95],
    "circle-stroke-color": ["case", ["get", "selected"], "#f2b41b", ["get", "ring"]],
    "circle-stroke-width": hlLayer ? ["case", ["get", "selected"], 4, ["get", "tinted"], 2.5, 1.5] : ["step", ["zoom"], 0.5, LIVE_DETAIL_ZOOM, 1.5],
    "circle-stroke-opacity": ["case", ["get", "dim"], 0.3, 1],
  });
  useGeoJsonLayer(
    "vehicles",
    data,
    [
      {
        id: "vehicles-fleet",
        type: "circle",
        minzoom: LIVE_MIN_ZOOM,
        filter: ["!", ["get", "hl"]],
        paint: circlePaint(false),
      },
      {
        id: "vehicles-focus",
        type: "circle",
        filter: ["get", "hl"],
        paint: circlePaint(true),
      },
      {
        id: "vehicles-tick",
        type: "symbol",
        minzoom: LIVE_DETAIL_ZOOM,
        filter: ["all", ["get", "hasBearing"], ["!", ["get", "dim"]]],
        layout: {
          "text-field": "▲",
          "text-size": ["case", ["get", "hl"], 9, 7],
          "text-font": ["Noto Sans Bold"],
          "text-rotate": ["get", "bearing"],
          "text-rotation-alignment": "map",
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: { "text-color": "#ffffff", "text-opacity": 0.95 },
      },
      {
        id: "vehicles-label",
        type: "symbol",
        minzoom: LIVE_DETAIL_ZOOM,
        filter: ["all", ["!", ["get", "dim"]], ["any", ["get", "hl"], [">=", ["zoom"], 17]]],
        layout: {
          "text-field": ["get", "label"],
          "text-size": 10,
          "text-offset": [0, -1.3],
          "text-font": ["Noto Sans Bold"],
          "text-allow-overlap": false,
          "text-optional": true,
        },
        paint: { "text-color": ["get", "color"], "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
      },
    ],
    {
      clickLayers: ["vehicles-fleet", "vehicles-focus"],
      onClick: (f) => {
        const v = byId.get(String(f.properties?.id));
        if (v) onClick?.(v);
      },
    },
  );
  return null;
}

// ── Station services (POIs) ─────────────────────────────────────────────────
const POI_COLOR: Record<PoiType, string> = {
  bike_parking: "#2e7d4f",
  toilets: "#0b5cd5",
  atm: "#6a1b9a",
  health: "#c62828",
  library: "#e8590c",
  other: "#667085",
};
const POI_GLYPH: Record<PoiType, string> = { bike_parking: "B", toilets: "WC", atm: "$", health: "+", library: "L", other: "•" };

export function PoisLayer({ pois, onClick }: { pois: PoiCollection | null | undefined; onClick?: (p: PoiCollection["features"][number]["properties"]) => void }) {
  const byId = useMemo(() => new Map((pois?.features ?? []).map((f) => [f.properties.id, f.properties])), [pois]);
  const data = useMemo(
    () =>
      fc(
        (pois?.features ?? []).map((f) =>
          toPoint(f.geometry.coordinates[0], f.geometry.coordinates[1], {
            id: f.properties.id,
            color: POI_COLOR[f.properties.type] ?? POI_COLOR.other,
            glyph: POI_GLYPH[f.properties.type] ?? "•",
            name: f.properties.name ?? "",
          }),
        ),
      ),
    [pois],
  );
  useGeoJsonLayer(
    "pois",
    data,
    [
      {
        id: "pois-circle",
        type: "circle",
        minzoom: 12,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 5, 16, 10],
          "circle-color": "#ffffff",
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 2,
        },
      },
      {
        id: "pois-glyph",
        type: "symbol",
        minzoom: 13,
        layout: { "text-field": ["get", "glyph"], "text-size": 9, "text-font": ["Noto Sans Bold"], "text-allow-overlap": true },
        paint: { "text-color": ["get", "color"] },
      },
    ],
    {
      clickLayers: ["pois-circle"],
      onClick: (f) => {
        const p = byId.get(String(f.properties?.id));
        if (p) onClick?.(p);
      },
    },
  );
  return null;
}


// ── Shared bikes (GBFS stations) ─────────────────────────────────────────────
export const RENTAL_MIN_ZOOM = 14;
export const RENTAL_LABEL_ZOOM = 15;

/**
 * Bike-share stations as small rings in their network's colour with the number of
 * available vehicles inside (UX audit: hidden below zoom 14, labels only from 15).
 * Works for N networks: colours come from `networks` by `station.networkId`.
 */
export function RentalStationsLayer({
  stations,
  networks,
  onClick,
  selectedId,
  id = "rental",
}: {
  stations: RentalStation[];
  networks: BikeShareNetwork[];
  onClick?: (s: RentalStation) => void;
  selectedId?: string | null;
  id?: string;
}) {
  const byId = useMemo(() => new Map(stations.map((s) => [s.id, s])), [stations]);
  const colorOf = useMemo(() => new Map(networks.map((n) => [n.id, n.color])), [networks]);
  const data = useMemo(
    () =>
      fc(
        stations.map((s) =>
          toPoint(s.lon, s.lat, {
            id: s.id,
            n: s.vehiclesAvailable,
            label: String(s.vehiclesAvailable),
            color: colorOf.get(s.networkId) ?? "#00A859",
            empty: s.vehiclesAvailable <= 0 || !s.isRenting,
            selected: s.id === selectedId,
          }),
        ),
      ),
    [stations, colorOf, selectedId],
  );
  useGeoJsonLayer(
    id,
    data,
    [
      {
        id: `${id}-ring`,
        type: "circle",
        minzoom: RENTAL_MIN_ZOOM,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], RENTAL_MIN_ZOOM, 5, RENTAL_LABEL_ZOOM, 8, 17, 11],
          "circle-color": "#ffffff",
          "circle-stroke-color": ["case", ["get", "selected"], "#f2b41b", ["get", "color"]],
          // zoom expressions must be top-level: interpolate with a per-stop `case`
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], RENTAL_MIN_ZOOM, ["case", ["get", "selected"], 4, 2], 17, ["case", ["get", "selected"], 4.5, 3]],
          "circle-stroke-opacity": ["case", ["get", "empty"], 0.45, 1],
          "circle-opacity": ["case", ["get", "empty"], 0.7, 1],
        },
      },
      {
        id: `${id}-count`,
        type: "symbol",
        minzoom: RENTAL_LABEL_ZOOM,
        layout: { "text-field": ["get", "label"], "text-size": ["interpolate", ["linear"], ["zoom"], RENTAL_LABEL_ZOOM, 9, 17, 11], "text-font": ["Noto Sans Bold"], "text-allow-overlap": true, "text-ignore-placement": true },
        paint: { "text-color": ["case", ["get", "empty"], "#98a2b3", ["get", "color"]] },
      },
    ],
    {
      clickLayers: [`${id}-ring`],
      onClick: (f) => {
        const s = byId.get(String(f.properties?.id));
        if (s) onClick?.(s);
      },
    },
  );
  return null;
}

/** Current viewport as [minLon, minLat, maxLon, maxLat], updated on moveend (debounced). */
export function useMapBounds(debounceMs = 300): BBox | null {
  const { map } = useMap();
  const [bbox, setBbox] = useState<BBox | null>(null);
  useEffect(() => {
    if (!map) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const read = () => {
      const b = map.getBounds();
      setBbox([+b.getWest().toFixed(4), +b.getSouth().toFixed(4), +b.getEast().toFixed(4), +b.getNorth().toFixed(4)]);
    };
    const onMove = () => {
      if (t) clearTimeout(t);
      t = setTimeout(read, debounceMs);
    };
    read();
    map.on("moveend", onMove);
    return () => {
      map.off("moveend", onMove);
      if (t) clearTimeout(t);
    };
  }, [map, debounceMs]);
  return bbox;
}

/**
 * Overlay buttons share one position rule: top-right below the header on desktop,
 * bottom-right just above the sheet on phones (`--sheet-h` is set by SplitLayout).
 */
export const overlayBtn =
  "grid h-11 w-11 place-items-center rounded-xl border shadow-card md:h-9 md:w-9 md:rounded-lg";
export function overlayPos(slot: number): React.CSSProperties {
  return {
    // phones: stacked upward from the sheet edge
    bottom: `calc(var(--sheet-h, 0px) + ${12 + slot * 52}px)`,
  };
}

/** Floating toggle rendered over the map (kept for pages that only need one). */
export function MapToggle({ on, onClick, label, icon, top = 76 }: { on: boolean; onClick: () => void; label: string; icon: React.ReactNode; top?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={label}
      aria-label={label}
      className={`absolute right-2 z-10 grid h-9 w-9 place-items-center rounded-lg border shadow-card md:right-4 ${on ? "border-ink bg-ink text-paper" : "border-line bg-paper-2 text-ink-2 hover:text-ink"}`}
      style={{ top }}
    >
      {icon}
    </button>
  );
}

export type LayerItem = { key: string; label: string; on: boolean; onChange: (on: boolean) => void; hint?: string | null; disabled?: boolean };

/** One "Capas" button → popover with layer toggles (live buses, services, network). */
export function LayersControl({ items, label, slot = 1 }: { items: LayerItem[]; label: string; slot?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);
  const anyOn = items.some((i) => i.on);
  return (
    <div ref={ref} className="absolute right-3 z-10 md:bottom-auto md:right-4 md:top-[76px]" style={overlayPos(slot)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
        aria-label={label}
        className={`${overlayBtn} ${open || anyOn ? "border-ink bg-ink text-paper" : "border-line bg-paper-2/95 text-ink-2 backdrop-blur hover:text-ink"}`}
      >
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M10 3l7 4-7 4-7-4 7-4Z" />
          <path d="M3 10.5l7 4 7-4M3 14l7 4 7-4" />
        </svg>
      </button>
      {open ? (
        <div role="dialog" aria-label={label} className="absolute bottom-full right-0 mb-2 w-60 rounded-xl border border-line bg-paper-2 p-2 shadow-card md:bottom-auto md:top-full md:mt-2">
          <p className="px-2 pb-1 pt-1 text-xs font-bold text-ink-2">{label}</p>
          <ul className="flex flex-col">
            {items.map((it) => (
              <li key={it.key}>
                <label className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-paper-3 ${it.disabled ? "opacity-60" : ""}`}>
                  <input type="checkbox" className="h-4 w-4 accent-[var(--signal)]" checked={it.on} disabled={it.disabled} onChange={(e) => it.onChange(e.target.checked)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{it.label}</span>
                    {it.hint ? <span className="block text-[11px] leading-snug text-ink-3">{it.hint}</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** "Mi ubicación" button: locates, then eases the map to the position. */
export function LocateButton({ onLocate, busy, label, slot = 0 }: { onLocate: () => Promise<{ lat: number; lon: number } | null> | void; busy?: boolean; label: string; slot?: number }) {
  const { map } = useMap();
  return (
    <button
      type="button"
      onClick={async () => {
        const pos = await onLocate();
        if (pos && map) map.easeTo({ center: [pos.lon, pos.lat], zoom: Math.max(map.getZoom(), 15.5), duration: 600 });
      }}
      title={label}
      aria-label={label}
      aria-busy={busy}
      className={`${overlayBtn} absolute right-3 z-10 border-line bg-paper-2/95 text-ink-2 backdrop-blur hover:text-ink md:bottom-auto md:right-4 md:top-[120px]`}
      style={overlayPos(slot)}
    >
      <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" className={busy ? "animate-pulse" : ""}>
        <circle cx="10" cy="10" r="5" />
        <circle cx="10" cy="10" r="1.5" fill="currentColor" />
        <path d="M10 2v3M10 15v3M2 10h3M15 10h3" />
      </svg>
    </button>
  );
}

/** Renders children only when the map is at or above `min` zoom (or `force`). */
export function ZoomGate({ min, force = false, children }: { min: number; force?: boolean; children: React.ReactNode }) {
  const z = useMapZoom();
  return force || z >= min ? <>{children}</> : null;
}

/** Small legend for ETA-tinted markers. */
export function EtaLegend({ labels, className = "" }: { labels: { now: string; soon: string; later: string; far: string; title: string }; className?: string }) {
  const items: [keyof typeof ETA_COLORS, string][] = [
    ["now", labels.now],
    ["soon", labels.soon],
    ["later", labels.later],
    ["far", labels.far],
  ];
  return (
    <div className={`pointer-events-none absolute left-3 z-10 rounded-lg border border-line bg-paper-2/95 px-2.5 py-1.5 text-[11px] shadow-card md:bottom-4 md:left-auto md:right-14 ${className}`} style={{ bottom: "calc(var(--sheet-h, 0px) + 12px)" }}>
      <span className="mr-2 font-semibold text-ink-2">{labels.title}</span>
      {items.map(([k, l]) => (
        <span key={k} className="mr-2 inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: ETA_COLORS[k] }} /> {l}
        </span>
      ))}
    </div>
  );
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
