"use client";

import { useI18n } from "@/lib/i18n/provider";
import { fmtDistance } from "@/lib/format";
import { Button, Icon } from "@/components/ui/primitives";
import type { FollowState } from "@/lib/follow";
import type { Itinerary } from "@/lib/api/types";

/** "Iniciar viaje" (web version): a button and a small status strip; the leg list highlights the current leg. */
export function FollowAlong({ itinerary, state, active, onToggle }: { itinerary: Itinerary; state: FollowState; active: boolean; onToggle: () => void }) {
  const { t, lang } = useI18n();
  const leg = state.legIndex !== null ? itinerary.legs[state.legIndex] : null;
  const nearEnd = leg?.transit && state.metersToLegEnd !== null && state.metersToLegEnd < 400;
  return (
    <div className={`rounded-card border p-3 ${active ? "border-signal bg-signal-soft/60" : "border-line bg-paper-2"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold">{active ? t.follow.title : t.follow.start}</p>
          {!active ? <p className="text-xs text-ink-3">{t.follow.hint}</p> : null}
        </div>
        <Button size="sm" variant={active ? "secondary" : "primary"} onClick={onToggle}>
          <Icon.Locate width={16} height={16} />
          {active ? t.follow.stop : t.follow.start}
        </Button>
      </div>
      {active ? (
        <div className="mt-2 text-xs text-ink-2">
          {state.error ? (
            <p className="text-brick">{t.follow.denied}</p>
          ) : !state.pos ? (
            <p>{t.follow.locating}</p>
          ) : (
            <>
              {leg ? (
                <p>
                  {t.follow.currentLeg}: <span className="font-semibold text-ink">{leg.transit ? leg.route?.shortName ?? leg.mode : t.mode.WALK}</span>
                  {leg.to.name ? ` → ${leg.to.name}` : ""}
                </p>
              ) : null}
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-signal transition-[width]" style={{ width: `${Math.round(state.progress * 100)}%` }} />
              </div>
              <p className="mt-1 flex flex-wrap gap-x-3">
                {state.metersToLegEnd !== null ? <span>{t.follow.toLegEnd(fmtDistance(state.metersToLegEnd, lang))}</span> : null}
                {state.metersOff !== null && state.metersOff > 150 ? <span className="text-brick">{t.follow.offRoute(fmtDistance(state.metersOff, lang))}</span> : null}
              </p>
              {nearEnd ? <p className="mt-1 font-bold text-signal">{t.follow.nextIsYours}</p> : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
