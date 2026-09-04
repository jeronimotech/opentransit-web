import type { CityFares } from "../api/types";

/**
 * Same rule the planner uses (lib/fare.ts): one base fare, then each transfer inside
 * the window costs `transfer` up to `maxTransfers`; anything beyond is a new base fare.
 * Expressed over a transfer count so the admin form can preview "1 transbordo = $X".
 */
export function fareForTransfers(f: CityFares, transfers: number, withinWindow = true): number {
  let amount = f.base;
  let inWindow = 0;
  for (let i = 0; i < Math.max(0, Math.floor(transfers)); i++) {
    if (withinWindow && inWindow < f.maxTransfers) {
      amount += f.transfer;
      inWindow++;
    } else {
      amount += f.base;
      inWindow = 0;
    }
  }
  return amount;
}

export type FarePreviewRow = { transfers: number; withinWindow: boolean; amount: number };

/** Rows for the live preview: 0..3 transfers inside the window, plus 1 outside it. */
export function farePreview(f: CityFares): FarePreviewRow[] {
  const rows: FarePreviewRow[] = [0, 1, 2, 3].map((n) => ({
    transfers: n,
    withinWindow: true,
    amount: fareForTransfers(f, n, true),
  }));
  rows.push({ transfers: 1, withinWindow: false, amount: fareForTransfers(f, 1, false) });
  return rows;
}
