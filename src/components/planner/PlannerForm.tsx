"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button, Icon } from "@/components/ui/primitives";
import { PlaceInput } from "./PlaceInput";
import { fromLocalInput, toLocalInput } from "@/lib/format";
import type { City, Mode } from "@/lib/api/types";
import type { PlannerPoint, PlannerState } from "@/lib/planner-params";

const MODE_ICON: Partial<Record<Mode, React.ReactNode>> = {
  BUS: <Icon.Bus />,
  CABLE_CAR: <Icon.Cable />,
};

type Props = {
  city: City;
  state: PlannerState;
  onChange: (s: PlannerState) => void;
  onSubmit: () => void;
  onUseLocation: (kind: "from" | "to") => void;
  onPickOnMap: (kind: "from" | "to") => void;
  picking: "from" | "to" | null;
  locating: "from" | "to" | null;
  userPos: { lat: number; lon: number } | null;
  compact?: boolean;
};

export function PlannerForm({ city, state, onChange, onSubmit, onUseLocation, onPickOnMap, picking, locating, userPos, compact }: Props) {
  const { t, lang } = useI18n();
  const [showTime, setShowTime] = useState(!!state.time);
  const transitModes = city.modes.filter((m) => m !== "WALK" && m !== "BICYCLE" && m !== "CAR");

  const set = (patch: Partial<PlannerState>) => onChange({ ...state, ...patch, selected: null });
  const setPoint = (kind: "from" | "to", p: PlannerPoint | null) => set({ [kind]: p });

  const toggleMode = (m: Mode) => {
    const has = state.modes.includes(m);
    const next = has ? state.modes.filter((x) => x !== m) : [...state.modes, m];
    if (!next.length) return; // keep at least one transit mode
    set({ modes: next });
  };

  const timeValue = state.time ? toLocalInput(new Date(state.time), city.timezone) : toLocalInput(new Date(), city.timezone);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="relative flex flex-col gap-2">
        <PlaceInput
          city={city.id}
          kind="from"
          label={t.planner.from}
          placeholder={t.planner.fromPlaceholder}
          value={state.from}
          near={userPos ?? city.center}
          onChange={(p) => setPoint("from", p)}
          onUseLocation={() => onUseLocation("from")}
          onPickOnMap={() => onPickOnMap("from")}
          locating={locating === "from"}
          picking={picking === "from"}
          autoFocus={!compact && !state.from}
        />
        <PlaceInput
          city={city.id}
          kind="to"
          label={t.planner.to}
          placeholder={t.planner.toPlaceholder}
          value={state.to}
          near={userPos ?? city.center}
          onChange={(p) => setPoint("to", p)}
          onUseLocation={() => onUseLocation("to")}
          onPickOnMap={() => onPickOnMap("to")}
          locating={locating === "to"}
          picking={picking === "to"}
        />
        <button
          type="button"
          onClick={() => set({ from: state.to, to: state.from })}
          className="absolute -right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-line bg-paper-2 text-ink-2 shadow-sm hover:text-ink"
          aria-label={t.planner.swap}
          title={t.planner.swap}
        >
          <Icon.Swap />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-paper-3 p-0.5 text-sm font-semibold">
          <button
            type="button"
            onClick={() => {
              setShowTime(false);
              set({ time: null, arriveBy: false });
            }}
            className={`rounded-md px-3 py-1.5 ${!showTime ? "bg-paper-2 text-ink shadow-sm" : "text-ink-2"}`}
          >
            {t.planner.now}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowTime(true);
              if (!state.time) set({ time: fromLocalInput(timeValue, city.timezone), arriveBy: false });
            }}
            className={`rounded-md px-3 py-1.5 ${showTime && !state.arriveBy ? "bg-paper-2 text-ink shadow-sm" : "text-ink-2"}`}
          >
            {t.planner.departAt}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowTime(true);
              set({ time: state.time ?? fromLocalInput(timeValue, city.timezone), arriveBy: true });
            }}
            className={`rounded-md px-3 py-1.5 ${showTime && state.arriveBy ? "bg-paper-2 text-ink shadow-sm" : "text-ink-2"}`}
          >
            {t.planner.arriveBy}
          </button>
        </div>
        {showTime ? (
          <input
            type="datetime-local"
            aria-label={state.arriveBy ? t.planner.arriveBy : t.planner.departAt}
            className="h-9 rounded-lg border border-line bg-paper-2 px-2 text-sm text-ink"
            value={timeValue}
            onChange={(e) => e.target.value && set({ time: fromLocalInput(e.target.value, city.timezone) })}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {transitModes.map((m) => {
          const on = state.modes.includes(m);
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              onClick={() => toggleMode(m)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${on ? "border-ink bg-ink text-paper" : "border-line bg-paper-2 text-ink-2 hover:border-line-2"}`}
            >
              {MODE_ICON[m] ?? null}
              {t.mode[m]}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={state.wheelchair}
          onClick={() => set({ wheelchair: !state.wheelchair })}
          title={t.planner.wheelchairHint}
          className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${state.wheelchair ? "border-signal bg-signal-soft text-signal" : "border-line bg-paper-2 text-ink-2 hover:border-line-2"}`}
        >
          <Icon.Wheelchair />
          {t.planner.wheelchair}
        </button>
      </div>

      <Button type="submit" variant="primary" size="lg" disabled={!state.from || !state.to} className="w-full">
        <Icon.Search />
        {t.planner.search}
      </Button>
      <p className="sr-only">{lang}</p>
    </form>
  );
}
