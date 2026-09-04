import type { CityFares, Fare, Itinerary } from "./api/types";

/**
 * Estimated fare from city parameters (Maas-style): the API computes it, but when a
 * v1 API sends `fare: null` and the city carries `fares`, we estimate client-side with
 * the same rule: one base fare, then each transfer inside the window costs `transfer`
 * up to `maxTransfers`; anything beyond is a new base fare.
 */
export function estimateFare(it: Itinerary, fares: CityFares | null | undefined): Fare | null {
  if (it.fare) return it.fare;
  if (!fares) return null;
  const transit = it.legs.filter((l) => l.transit);
  if (!transit.length) return { amount: 0, currency: fares.currency, estimated: true, breakdown: [] };
  let amount = fares.base;
  const breakdown: { label: string; amount: number }[] = [{ label: "base", amount: fares.base }];
  let windowStart = new Date(transit[0].startTime).getTime();
  let transfersInWindow = 0;
  for (let i = 1; i < transit.length; i++) {
    const t = new Date(transit[i].startTime).getTime();
    const inWindow = t - windowStart <= fares.transferWindowMinutes * 60_000;
    if (inWindow && transfersInWindow < fares.maxTransfers) {
      amount += fares.transfer;
      transfersInWindow++;
      breakdown.push({ label: "transfer", amount: fares.transfer });
    } else {
      amount += fares.base;
      windowStart = t;
      transfersInWindow = 0;
      breakdown.push({ label: "base", amount: fares.base });
    }
  }
  return { amount, currency: fares.currency, estimated: true, breakdown };
}
