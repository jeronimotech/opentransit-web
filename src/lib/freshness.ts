import type { Freshness } from "./api/types";
import type { Dict } from "./i18n/dict";

export type FreshnessTone = "live" | "scheduled" | "stale";

/**
 * One rule for the whole app (TransMi App pattern): a time is "En vivo" only when it
 * carries realtime data; "Programado" when it is timetable; and when the feed itself is
 * stale we say so with the age, instead of pretending.
 */
export function freshnessLabel(
  t: Dict,
  f: Freshness | null | undefined,
  rowRealtime: boolean | null,
): { tone: FreshnessTone; label: string } {
  if (f?.stale) {
    return { tone: "stale", label: t.freshness.stale(f.ageSeconds ?? 0) };
  }
  if (rowRealtime) return { tone: "live", label: t.freshness.live };
  return { tone: "scheduled", label: t.freshness.scheduled };
}

export function freshnessFromAge(ageSeconds: number | null | undefined, threshold = 90): Freshness {
  const stale = ageSeconds != null && ageSeconds > threshold;
  return { realtime: ageSeconds != null, ageSeconds: ageSeconds ?? null, stale };
}
