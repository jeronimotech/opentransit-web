"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMap } from "./MapView";
import { useGeoJsonLayer } from "./layers";
import { circleRing } from "@/lib/near-me";
import { fc } from "@/lib/geo";
import type { LatLon } from "@/lib/api/types";
import type { Feature, Polygon } from "geojson";

/** The soft "how far I'm looking" disc under everything else. */
export function RadiusCircle({ center, radiusM }: { center: LatLon | null; radiusM: number }) {
  const data = useMemo(() => {
    if (!center) return fc([]);
    const ring = circleRing(center, radiusM);
    const f: Feature<Polygon> = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
    return fc([f]);
  }, [center?.lat, center?.lon, radiusM]); // eslint-disable-line react-hooks/exhaustive-deps

  useGeoJsonLayer("nearme-radius", data, [
    // Soft, but it has to read over a busy basemap: at 6 % the disc was invisible
    // in review, which defeats the point of showing how far "cerca" reaches.
    { id: "nearme-radius-fill", type: "fill", paint: { "fill-color": "#0b5cd5", "fill-opacity": 0.1 } },
    { id: "nearme-radius-line", type: "line", paint: { "line-color": "#0b5cd5", "line-width": 2, "line-opacity": 0.55, "line-dasharray": [3, 2] } },
  ]);
  return null;
}

/**
 * Follow-me camera. It re-centres on every fix while `following` is true, and the
 * moment the user pans or zooms *by hand* it hands control back — the page then
 * offers a pill to resume. Programmatic moves are flagged so our own easeTo does
 * not read as a gesture.
 */
export function useFollowCamera(pos: LatLon | null, following: boolean, zoom = 16): { userMoved: boolean; resetUserMoved: () => void } {
  const { map } = useMap();
  const [userMoved, setUserMoved] = useState(false);
  const selfMoving = useRef(false);

  useEffect(() => {
    if (!map) return;
    // `originalEvent` is present only when a human did it (wheel, drag, pinch).
    const onGesture = (e: { originalEvent?: unknown }) => {
      if (selfMoving.current) return;
      if (e?.originalEvent) setUserMoved(true);
    };
    map.on("dragstart", onGesture);
    map.on("zoomstart", onGesture);
    map.on("rotatestart", onGesture);
    return () => {
      map.off("dragstart", onGesture);
      map.off("zoomstart", onGesture);
      map.off("rotatestart", onGesture);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !pos || !following || userMoved) return;
    selfMoving.current = true;
    map.easeTo({ center: [pos.lon, pos.lat], zoom: Math.max(map.getZoom(), zoom), duration: 500 });
    const done = () => {
      selfMoving.current = false;
    };
    map.once("moveend", done);
    return () => {
      map.off("moveend", done);
      selfMoving.current = false;
    };
  }, [map, pos?.lat, pos?.lon, following, userMoved, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  return { userMoved, resetUserMoved: () => setUserMoved(false) };
}
