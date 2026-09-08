"use client";

import { useCallback, useEffect, useState } from "react";
import { MapView, useMap } from "@/components/map/MapView";
import { LocateButton } from "@/components/map/layers";
import { Button, Icon, Spinner } from "@/components/ui/primitives";
import { useReverse } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n/provider";
import { coordName, pointFrom, type Field } from "@/lib/place-choice";
import type { City } from "@/lib/api/types";
import type { PlannerPoint } from "@/lib/planner-params";

type LatLon = { lat: number; lon: number };

/**
 * Contract addendum v2.1 — "elegir en el mapa", for origin and destination alike.
 *
 * A full-screen map with a fixed crosshair: the person pans the city under it instead
 * of hunting for a marker. The centre is reverse geocoded (debounced) and shown in the
 * confirm bar, so they see what they are picking; when the geocoder says nothing the bar
 * shows the coordinates and confirming still works — a nameless point is a valid endpoint.
 */
export function MapPicker({
  city,
  field,
  initial,
  onConfirm,
  onCancel,
  onLocate,
  locating,
}: {
  city: City;
  field: Field;
  /** Where the map opens: the field's current point, the other end, the device, else the city. */
  initial: LatLon;
  onConfirm: (p: PlannerPoint) => void;
  onCancel: () => void;
  onLocate?: () => Promise<LatLon | null>;
  locating?: boolean;
}) {
  const { t } = useI18n();
  const [centre, setCentre] = useState<LatLon>(initial);
  const [moving, setMoving] = useState(false);
  const reverse = useReverse(city.id, moving ? null : centre);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const name = (reverse.data?.name ?? "").trim();
  const title = field === "from" ? t.planner.pickOrigin : t.planner.pickDestination;
  const resolving = moving || reverse.isFetching;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper" role="dialog" aria-modal="true" aria-label={title} data-testid="map-picker">
      <div className="relative flex-1">
        <MapView center={[initial.lon, initial.lat]} zoom={Math.max(city.defaultZoom, 16)} attribution={city.attribution} className="h-full w-full">
          <CentreProbe onCentre={setCentre} onMoving={setMoving} />
          {onLocate ? <LocateButton onLocate={onLocate} busy={locating} label={t.layers.locate} slot={0} /> : null}
          {/* the point being picked never moves: the map does */}
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-signal drop-shadow">
            <Icon.Crosshair width={40} height={40} strokeWidth={1.6} />
          </span>
        </MapView>

        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 p-3">
          <button
            type="button"
            onClick={onCancel}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-paper-2/95 text-ink-2 shadow-card backdrop-blur hover:text-ink"
            aria-label={t.planner.cancel}
            title={t.planner.cancel}
          >
            <Icon.Close />
          </button>
          <p className="min-w-0 flex-1 truncate rounded-full border border-line bg-paper-2/95 px-4 py-2.5 text-sm font-bold shadow-card backdrop-blur">{title}</p>
        </div>
      </div>

      <div className="border-t border-line bg-paper-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-start gap-3">
          <span aria-hidden className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${field === "from" ? "bg-ink text-paper" : "bg-signal text-signal-ink"}`}>
            {field === "from" ? "A" : "B"}
          </span>
          <span className="min-w-0 flex-1" aria-live="polite">
            <span className="flex items-center gap-2 text-[15px] font-bold">
              {resolving ? <Spinner /> : null}
              <span className="min-w-0 truncate" data-testid="picker-name">
                {resolving ? t.planner.pickResolving : name || coordName(centre.lat, centre.lon)}
              </span>
            </span>
            <span className="block truncate text-xs text-ink-3">
              {resolving ? t.planner.pickDragHint : name ? coordName(centre.lat, centre.lon) : t.planner.pickUnnamed}
            </span>
          </span>
        </div>
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full"
          data-testid="picker-confirm"
          onClick={() => onConfirm(pointFrom(centre.lat, centre.lon, name))}
        >
          <Icon.Check />
          {t.planner.pickConfirm}
        </Button>
      </div>
    </div>
  );
}

/**
 * Reports the map centre once the camera settles. Panning is continuous, so the
 * reverse geocode is debounced: one request per pause, not one per frame.
 */
function CentreProbe({ onCentre, onMoving, delay = 350 }: { onCentre: (p: LatLon) => void; onMoving: (v: boolean) => void; delay?: number }) {
  const { map } = useMap();
  const emit = useCallback(() => {
    if (!map) return;
    const c = map.getCenter();
    onCentre({ lat: c.lat, lon: c.lng });
    onMoving(false);
  }, [map, onCentre, onMoving]);

  useEffect(() => {
    if (!map) return;
    let h: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(h);
      h = setTimeout(emit, delay);
    };
    const start = () => {
      onMoving(true);
      clearTimeout(h);
    };
    emit();
    map.on("movestart", start);
    map.on("move", schedule);
    map.on("moveend", schedule);
    return () => {
      clearTimeout(h);
      map.off("movestart", start);
      map.off("move", schedule);
      map.off("moveend", schedule);
    };
  }, [map, emit, onMoving, delay]);
  return null;
}
