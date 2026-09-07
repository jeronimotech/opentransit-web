"use client";

import { RouteChip } from "@/components/ui/RouteChip";
import { EmptyState } from "@/components/ui/primitives";
import { formatDistance, widerRadius, type NearbyVehicle, type Radius } from "@/lib/near-me";
import { useI18n } from "@/lib/i18n/provider";

/** ↑ towards me, ↓ away, nothing when the frame carries no bearing. */
function MotionArrow({ motion }: { motion: NearbyVehicle["motion"] }) {
  const { t } = useI18n();
  if (!motion) return null;
  const approaching = motion === "approaching";
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${approaching ? "text-live" : "text-ink-3"}`}
      title={approaching ? t.nearMe.approaching : t.nearMe.away}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={approaching ? "" : "rotate-180"}>
        <path d="M5 1.5 L8.5 7 H1.5 Z" fill="currentColor" />
      </svg>
      {approaching ? t.nearMe.approaching : t.nearMe.away}
    </span>
  );
}

export function NearbyList({
  items,
  radius,
  selectedId,
  onSelect,
  onWiden,
  stale,
}: {
  items: NearbyVehicle[];
  radius: Radius;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onWiden: (r: Radius) => void;
  stale: boolean;
}) {
  const { t } = useI18n();
  const wider = widerRadius(radius);

  if (!items.length) {
    return (
      <div data-testid="nearme-empty">
      <EmptyState
        title={t.nearMe.empty(radius)}
        hint={wider ? undefined : t.nearMe.emptyWidest}
        action={
          wider ? (
            <button
              type="button"
              onClick={() => onWiden(wider)}
              className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-sm font-semibold text-paper"
            >
              {t.nearMe.widen(wider)}
            </button>
          ) : undefined
        }
      />
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5" data-testid="nearby-rows">
      {items.map(({ vehicle: v, distanceMeters, motion }) => {
        const on = v.id === selectedId;
        return (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => onSelect(v.id)}
              aria-pressed={on}
              className={`flex w-full items-center gap-3 rounded-card border px-3 py-2 text-left transition-colors ${
                on ? "border-ink bg-paper-2" : "border-line bg-paper hover:border-line-2"
              }`}
            >
              <RouteChip
                route={{ shortName: v.routeShortName ?? "—", color: "", mode: "BUS", component: v.component }}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{v.label ?? v.routeShortName ?? v.id}</span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-2">
                  <span className="tabular-nums">{formatDistance(distanceMeters)}</span>
                  <MotionArrow motion={motion} />
                </span>
              </span>
              {/* A stale feed must not look live: the dot goes quiet with the data. */}
              <span className={`live-dot shrink-0 ${stale ? "opacity-30" : ""}`} aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
