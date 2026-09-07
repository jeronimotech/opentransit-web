"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useAlerts, usePlan } from "@/lib/api/hooks";
import { useNow } from "@/lib/use-now";
import { useFavorites } from "@/lib/favorites";
import { alertsOnItinerary, autoDirection, flipDirection, resolveCommute, type CommuteDirection } from "@/lib/commute";
import { leaveByOf } from "@/lib/leave-by";
import { fmtTime } from "@/lib/format";
import { Icon, Spinner } from "@/components/ui/primitives";
import { RouteChip } from "@/components/ui/RouteChip";
import { toPlanParams, type PlannerState } from "@/lib/planner-params";
import { DEFAULT_MODES } from "@/lib/planner-params";
import type { City } from "@/lib/api/types";

/**
 * Casa ⇄ Trabajo (Lote 2 B1). One line that answers "when do I have to leave?"
 * for the trip you are most likely to make right now. Direction is guessed from
 * the city clock and can be inverted; an alert on any route of the plan turns the
 * card into a warning that offers a re-plan.
 */
export function CommuteCard({
  city,
  pos,
  onOpen,
}: {
  city: City;
  pos: { lat: number; lon: number } | null;
  onOpen: (s: Partial<PlannerState>) => void;
}) {
  const { t, lang } = useI18n();
  const now = useNow(15_000);
  const fav = useFavorites(city.id);
  const home = fav.places.find((p) => p.placeKind === "home");
  const work = fav.places.find((p) => p.placeKind === "work");
  const auto = autoDirection(home, work, now, city.timezone);
  const [override, setOverride] = useState<CommuteDirection | null>(null);
  const direction = override ?? auto;
  const plan = useMemo(() => (direction ? resolveCommute(home, work, direction) : null), [home, work, direction]);

  // origin: the other saved place, or the device when only one is saved
  const origin = useMemo(
    () => plan?.origin ?? (pos ? { lat: pos.lat, lon: pos.lon, name: t.lote23.commute.fromHere } : null),
    [plan, pos, t.lote23.commute.fromHere],
  );
  const params = useMemo(
    () =>
      plan && origin
        ? toPlanParams(
            {
              from: { lat: origin.lat, lon: origin.lon, name: origin.name ?? null },
              to: { lat: plan.destination.lat, lon: plan.destination.lon, name: plan.destination.name },
              time: null,
              arriveBy: false,
              modes: DEFAULT_MODES,
              wheelchair: false,
              bike: false,
              rental: false,
              taxi: false,
              selected: null,
            },
            lang,
          )
        : null,
    [plan, origin, lang],
  );
  const q = usePlan(city.id, params);
  const best = q.data?.itineraries?.[0] ?? null;
  const alerts = useAlerts(city.id);
  const hits = alertsOnItinerary(best, alerts.data?.alerts);

  if (!plan || !direction) {
    return (
      <p className="rounded-xl border border-dashed border-line-2 px-3 py-2.5 text-xs text-ink-3" data-testid="commute-empty">
        {t.lote23.commute.setPlaces}
      </p>
    );
  }

  const leave = best ? leaveByOf(best, now) : null;
  const label = direction === "toWork" ? t.lote23.commute.toWork : t.lote23.commute.toHome;
  const open = () =>
    onOpen({
      from: origin ? { lat: origin.lat, lon: origin.lon, name: origin.name ?? null } : null,
      to: { lat: plan.destination.lat, lon: plan.destination.lon, name: plan.destination.name },
      selected: null,
    });

  return (
    <section aria-labelledby="commute-title" data-testid="commute-card">
      <div className="mb-1.5 flex items-baseline justify-between">
        <h2 id="commute-title" className="text-sm font-bold">
          {t.lote23.commute.title}
        </h2>
        {home && work ? (
          <button type="button" onClick={() => setOverride(flipDirection(direction))} className="inline-flex h-7 items-center gap-1 text-xs font-semibold text-signal" data-testid="commute-invert">
            <Icon.Swap width={13} height={13} /> {t.lote23.commute.invert}
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={open}
        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left hover:border-ink ${hits.length ? "border-disruption bg-disruption-soft" : "border-line bg-paper-2"}`}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink text-paper">
          {direction === "toWork" ? <Icon.Work width={18} height={18} /> : <Icon.Home width={18} height={18} />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="truncate text-[13px] font-bold">{label}</span>
            <span className="truncate text-[11px] text-ink-3">{plan.destination.name}</span>
          </span>

          <span className="mt-0.5 flex min-h-5 items-center gap-2 text-xs">
            {q.isLoading ? (
              <span className="inline-flex items-center gap-1.5 text-ink-3">
                <Spinner className="h-3 w-3" /> {t.lote23.commute.loading}
              </span>
            ) : hits.length ? (
              <span className="font-bold text-disruption">{t.lote23.commute.detour}</span>
            ) : best && leave ? (
              <>
                <span className="font-bold text-moss">{leave.kind === "in" ? t.lote23.commute.leaveIn(leave.minutes) : t.lote23.commute.leaveNow}</span>
                {best.legs
                  .filter((l) => l.transit && l.route)
                  .slice(0, 2)
                  .map((l, i) => (
                    <RouteChip key={`${l.route!.id}-${i}`} route={l.route} size="sm" />
                  ))}
                <span className="tabular-nums text-ink-3">{fmtTime(best.endTime, city.timezone, lang)}</span>
              </>
            ) : (
              <span className="text-ink-3">{t.lote23.commute.none}</span>
            )}
          </span>
        </span>

        <span className="shrink-0 text-xs font-semibold text-signal">{t.lote23.commute.see}</span>
      </button>
    </section>
  );
}
