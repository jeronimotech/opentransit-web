import type { ForecastNote, ForecastOption, ForecastResponse } from "./api/types";

/**
 * "Cuándo salir" (Lote 2 B2). The API answers with one row per possible departure
 * across a window; this module turns that into what the panel draws: rows in time
 * order, the recommended one marked, and the long waits called out between rows so
 * "después no hay servicio hasta las 21:40" is visible *where the gap happens*.
 */

/** A gap is worth showing when the next departure is this far away. */
export const GAP_THRESHOLD_SECONDS = 20 * 60;

export type ForecastRow = {
  option: ForecastOption;
  /** Gap to the following row, only when it exceeds the threshold. */
  gapAfterSeconds: number | null;
  /** True for the last row when the API flagged the end of service. */
  lastService: boolean;
};

/** The API spells it `at`; an early draft used `atrs`. Accept both, prefer `at`. */
export const noteAt = (n: ForecastNote): string | null => n.at ?? n.atrs ?? null;

/**
 * Gap between consecutive options. The API may send `gapAfterSeconds`; when it does
 * not, derive it from the next departure so the panel behaves the same either way.
 */
export function gapAfter(options: ForecastOption[], i: number): number | null {
  const o = options[i];
  const next = options[i + 1];
  const raw = o?.gapAfterSeconds ?? (next ? (Date.parse(next.departAt) - Date.parse(o.departAt)) / 1000 : null);
  if (raw === null || !Number.isFinite(raw)) return null;
  return raw >= GAP_THRESHOLD_SECONDS ? Math.round(raw) : null;
}

export function toRows(res: ForecastResponse | undefined | null): ForecastRow[] {
  const options = [...(res?.options ?? [])].sort((a, b) => Date.parse(a.departAt) - Date.parse(b.departAt));
  const endsNote = (res?.notes ?? []).find((n) => n.kind === "last_service" || n.kind === "service_ends");
  return options.map((option, i) => ({
    option,
    gapAfterSeconds: gapAfter(options, i),
    lastService: !!endsNote && i === options.length - 1,
  }));
}

/** The row the panel highlights: the API's pick, else the earliest arrival. */
export function recommendedIndex(rows: ForecastRow[]): number {
  const flagged = rows.findIndex((r) => r.option.recommended);
  if (flagged >= 0) return flagged;
  if (!rows.length) return -1;
  let best = 0;
  for (let i = 1; i < rows.length; i++) {
    if (Date.parse(rows[i].option.arriveAt) < Date.parse(rows[best].option.arriveAt)) best = i;
  }
  return best;
}

/** Minutes from `now` to a departure; negative once it has gone. */
export const minutesTo = (iso: string, now: number): number => Math.round((Date.parse(iso) - now) / 60_000);
