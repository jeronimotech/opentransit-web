"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "@/components/map/MapView";
import { useI18n } from "@/lib/i18n/provider";
import type { Field } from "@/lib/place-choice";

/** How long a touch must rest before it means "pick this point" rather than a pan. */
const HOLD_MS = 550;
/** A finger that travels further than this was panning, not holding. */
const SLOP_PX = 12;

type Pt = { lat: number; lon: number };

/**
 * Contract addendum v2.1 — a long press on the main map is the second way into
 * choosing an endpoint, next to the field's own action.
 *
 * The map is the primary surface, so pressing a spot on it should be able to start a
 * trip there. A press that turns into a pan must never steal the gesture, hence the
 * movement slop and the cancel on drag/zoom. Right-click is the pointer equivalent.
 */
export function LongPressPick({ onPick }: { onPick: (field: Field, p: Pt) => void }) {
  const { map } = useMap();
  const [at, setAt] = useState<(Pt & { x: number; y: number }) | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!map) return;
    const canvas = map.getCanvas();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let start: { x: number; y: number } | null = null;

    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      start = null;
    };
    const openAt = (x: number, y: number) => {
      const ll = map.unproject([x, y]);
      setAt({ lat: ll.lat, lon: ll.lng, x, y });
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return clear();
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      start = { x: t.clientX - rect.left, y: t.clientY - rect.top };
      timer = setTimeout(() => {
        if (start) openAt(start.x, start.y);
        clear();
      }, HOLD_MS);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 1) return clear();
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const dx = t.clientX - rect.left - start.x;
      const dy = t.clientY - rect.top - start.y;
      if (Math.hypot(dx, dy) > SLOP_PX) clear();
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      openAt(e.clientX - rect.left, e.clientY - rect.top);
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", clear);
    canvas.addEventListener("touchcancel", clear);
    canvas.addEventListener("contextmenu", onContextMenu);
    map.on("dragstart", clear);
    map.on("zoomstart", clear);
    return () => {
      clear();
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", clear);
      canvas.removeEventListener("touchcancel", clear);
      canvas.removeEventListener("contextmenu", onContextMenu);
      map.off("dragstart", clear);
      map.off("zoomstart", clear);
    };
  }, [map]);

  const { t } = useI18n();
  if (!at) return null;
  const choose = (field: Field) => {
    onPickRef.current(field, { lat: at.lat, lon: at.lon });
    setAt(null);
  };
  return (
    <>
      <button type="button" aria-label={t.common.close} onClick={() => setAt(null)} className="absolute inset-0 z-20 cursor-default" />
      <div
        role="menu"
        data-testid="longpress-pick"
        style={{ left: at.x, top: at.y }}
        className="absolute z-30 -translate-x-1/2 -translate-y-full pb-3"
      >
        <div className="overflow-hidden rounded-2xl border border-line bg-paper-2 shadow-card">
          <button type="button" role="menuitem" onClick={() => choose("from")} className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left text-sm font-semibold hover:bg-paper-3">
            {t.planner.setAsOrigin}
          </button>
          <button type="button" role="menuitem" onClick={() => choose("to")} className="flex min-h-11 w-full items-center gap-2 border-t border-line px-4 py-2 text-left text-sm font-semibold hover:bg-paper-3">
            {t.planner.setAsDestination}
          </button>
        </div>
      </div>
    </>
  );
}
