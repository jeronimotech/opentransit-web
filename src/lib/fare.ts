import type { CityFares, Fare, FareLine, Itinerary } from "./api/types";

/**
 * Estimated fare from city parameters (Maas-style): the API computes it, but when a
 * v1 API sends `fare: null` and the city carries `fares`, we estimate client-side with
 * the same rule: one base fare, then each transfer inside the window costs `transfer`
 * up to `maxTransfers`; anything beyond is a new base fare.
 */
export function estimateFare(it: Itinerary, fares: CityFares | null | undefined): Fare | null {
  if (it.fare) return it.fare;
  const rental = rentalLines(it);
  if (!fares) return rental.length ? { amount: rental.reduce((a, b) => a + b.amount, 0), currency: rental[0].currency, estimated: true, breakdown: rental } : null;
  const transit = it.legs.filter((l) => l.transit);
  if (!transit.length) return { amount: rental.reduce((a, b) => a + b.amount, 0), currency: fares.currency, estimated: true, breakdown: rental };
  let amount = fares.base;
  const breakdown: FareLine[] = [{ label: "base", amount: fares.base, kind: "transit" }];
  let windowStart = new Date(transit[0].startTime).getTime();
  let transfersInWindow = 0;
  for (let i = 1; i < transit.length; i++) {
    const t = new Date(transit[i].startTime).getTime();
    const inWindow = t - windowStart <= fares.transferWindowMinutes * 60_000;
    if (inWindow && transfersInWindow < fares.maxTransfers) {
      amount += fares.transfer;
      transfersInWindow++;
      breakdown.push({ label: "transfer", amount: fares.transfer, kind: "transit" });
    } else {
      amount += fares.base;
      windowStart = t;
      transfersInWindow = 0;
      breakdown.push({ label: "base", amount: fares.base, kind: "transit" });
    }
  }
  for (const r of rental) {
    amount += r.amount;
    breakdown.push(r);
  }
  return { amount, currency: fares.currency, estimated: true, breakdown };
}

/** One fare line per shared-vehicle network used (a day pass covers every leg of that network). */
export function rentalLines(it: Itinerary): (FareLine & { currency: string })[] {
  const seen = new Map<string, FareLine & { currency: string }>();
  for (const l of it.legs) {
    const p = l.rental?.priceEstimate;
    if (!l.rental || !p || seen.has(l.rental.networkId)) continue;
    seen.set(l.rental.networkId, { label: `${l.rental.networkName} · ${p.label}`, amount: p.amount, kind: "rental", currency: p.currency });
  }
  return [...seen.values()];
}
