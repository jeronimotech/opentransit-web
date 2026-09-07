import type { SharedEta, ShareState } from "./api/types";

/**
 * Shared ETA (Lote 3 C6). The public page has four states and each one changes what
 * the reader should do, so they are resolved in one place: still travelling, running
 * late, arrived, and gone (revoked or expired). A trip whose window has passed is
 * treated as expired even if the API row is still there.
 */

export type ShareView = "on_time" | "delayed" | "arrived" | "ended" | "expired";

export function shareView(data: SharedEta | null | undefined, now: number): ShareView {
  if (!data) return "expired";
  if (Date.parse(data.expiresAt) <= now) return "expired";
  const st: ShareState | undefined = data.progress?.state;
  if (st === "cancelled") return "ended";
  if (st === "arrived") return "arrived";
  if (st === "delayed") return "delayed";
  return "on_time";
}

/** Minutes left until the shared ETA, from the progress when present, else the plan. */
export function minutesLeft(data: SharedEta | null | undefined, now: number): number | null {
  const iso = data?.progress?.etaAt ?? data?.itinerary.endTime;
  if (!iso) return null;
  const m = Math.round((Date.parse(iso) - now) / 60_000);
  return Number.isFinite(m) ? m : null;
}

/** How stale the shared position is, in seconds (null when never updated). */
export function progressAgeSeconds(data: SharedEta | null | undefined, now: number): number | null {
  if (!data?.updatedAt) return null;
  const s = Math.round((now - Date.parse(data.updatedAt)) / 1000);
  return Number.isFinite(s) && s >= 0 ? s : null;
}

/** A trip still in motion is worth polling; an arrived or ended one is not. */
export const isLive = (v: ShareView) => v === "on_time" || v === "delayed";
