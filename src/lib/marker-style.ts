/**
 * Live-fleet rendering rules by zoom (UX audit B). Pure so it can be unit-tested and
 * shared by the layer (paint expressions) and the layers popover (hint text).
 *
 *   < 14  → not drawn, unless the vehicle belongs to a highlighted route/stop context
 *   14–16 → 6 px dots at 70 % opacity
 *   ≥ 16  → 10 px dots with a bearing tick, full opacity
 */
export const LIVE_MIN_ZOOM = 14;
export const LIVE_DETAIL_ZOOM = 16;

export type MarkerStyle = { visible: boolean; radius: number; opacity: number; tick: boolean };

export function vehicleStyleForZoom(zoom: number, highlighted = false): MarkerStyle {
  if (zoom < LIVE_MIN_ZOOM && !highlighted) return { visible: false, radius: 0, opacity: 0, tick: false };
  if (zoom < LIVE_DETAIL_ZOOM) {
    return highlighted ? { visible: true, radius: 5, opacity: 1, tick: false } : { visible: true, radius: 3, opacity: 0.7, tick: false };
  }
  return { visible: true, radius: 5, opacity: 1, tick: true };
}

/** Is the fleet auto-enabled at this zoom (the "Capas" popover shows a hint when not)? */
export function liveAutoOn(zoom: number): boolean {
  return zoom >= LIVE_MIN_ZOOM;
}
