"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/primitives";
import { ItineraryCard } from "./ItineraryCard";
import { SortMenu } from "@/components/planner/SortMenu";
import { groupByScenario, type Scenario } from "@/lib/scenarios";
import { sortItineraries, type SortKey } from "@/lib/sort";
import { demoteDeparted, leaveByOf } from "@/lib/leave-by";
import { useNow } from "@/lib/use-now";
import type { CityFares, Itinerary } from "@/lib/api/types";

const SCENARIO_ICON: Record<Scenario, keyof typeof Icon> = { fastest: "Route", lessWalking: "Walk", fewestTransfers: "Bus", cheapest: "Fare", bike: "Bike", ondemand: "Car" };

/**
 * Results grouped by scenario (Citymapper): one expanded card per section (the best
 * of that angle) and the rest as one-line rows behind "N opciones más". A 15-s clock
 * drives the "Sal en X min" countdown; departed options sink to the bottom of their
 * section and, once two or more have left, an "Actualizar" chip offers a re-plan.
 */
export function ResultsList({ itineraries, all, tz, fares, realtime, onSelect, onRefresh }: { itineraries: Itinerary[]; all: Itinerary[]; tz: string; fares?: CityFares | null; realtime: boolean; onSelect: (index: number) => void; onRefresh: () => void }) {
  const { t } = useI18n();
  const now = useNow(15_000);
  const [sort, setSort] = useState<SortKey>("default");
  const [openMore, setOpenMore] = useState<Set<Scenario>>(new Set());
  useEffect(() => setOpenMore(new Set()), [all]);

  const groups = useMemo(() => {
    const sorted = sortItineraries(itineraries, sort, fares);
    return groupByScenario(sorted, fares).map((g) => {
      const { list } = demoteDeparted([g.best, ...g.rest], now);
      return { scenario: g.scenario, best: list[0], rest: list.slice(1) };
    });
  }, [itineraries, sort, fares, now]);
  const departedCount = useMemo(() => itineraries.filter((it) => leaveByOf(it, now).kind === "departed").length, [itineraries, now]);
  const idx = (it: Itinerary) => all.indexOf(it);

  return (
    <div className="flex flex-col gap-4" data-testid="results">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-2">{t.planner.results}</h2>
        <div className="flex items-center gap-2">
          {realtime ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
              <span className="live-dot" /> {t.planner.realtime}
            </span>
          ) : null}
          <SortMenu value={sort} onChange={setSort} hasFares={!!fares} />
        </div>
      </div>

      {departedCount >= 2 ? (
        <button type="button" onClick={onRefresh} data-testid="refresh-chip" className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-full border border-disruption bg-disruption-soft px-3 text-xs font-bold text-ink">
          <Icon.Clock width={14} height={14} className="text-disruption" />
          {t.lote1.refresh} · <span className="font-medium text-ink-2">{t.lote1.refreshHint}</span>
        </button>
      ) : null}

      {groups.map((g) => {
        const IconEl = Icon[SCENARIO_ICON[g.scenario]] ?? Icon.Route;
        const open = openMore.has(g.scenario);
        return (
          <section key={g.scenario} data-testid={`scenario-${g.scenario}`} className="flex flex-col gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-2">
              <IconEl width={14} height={14} className="text-ink-3" />
              {t.lote1.scenarios[g.scenario]}
            </h3>
            <ItineraryCard itinerary={g.best} index={idx(g.best)} tz={tz} fares={fares} selected={false} now={now} onSelect={() => onSelect(idx(g.best))} />
            {g.rest.length ? (
              <>
                {open ? g.rest.map((it) => <ItineraryCard key={it.id} compact itinerary={it} index={idx(it)} tz={tz} fares={fares} selected={false} now={now} onSelect={() => onSelect(idx(it))} />) : null}
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenMore((s) => {
                    const n = new Set(s);
                    if (n.has(g.scenario)) n.delete(g.scenario);
                    else n.add(g.scenario);
                    return n;
                  })}
                  className="inline-flex h-8 items-center gap-1 self-start px-1 text-xs font-semibold text-signal"
                >
                  <Icon.Chevron width={12} height={12} className={`transition-transform ${open ? "-rotate-90" : "rotate-90"}`} />
                  {open ? t.lote1.less : t.lote1.more(g.rest.length)}
                </button>
              </>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
