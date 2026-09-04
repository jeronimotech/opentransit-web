"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button, Icon } from "@/components/ui/primitives";
import { PlaceInput } from "./PlaceInput";
import { fmtDateTime, fromLocalInput, toLocalInput } from "@/lib/format";
import { TRANSIT_MODES } from "@/lib/planner-params";
import type { City, Mode } from "@/lib/api/types";
import type { PlannerPoint, PlannerState } from "@/lib/planner-params";

const MODE_ICON: Partial<Record<Mode, React.ReactNode>> = {
  BUS: <Icon.Bus width={16} height={16} />,
  CABLE_CAR: <Icon.Cable width={16} height={16} />,
  BICYCLE: <Icon.Bike width={16} height={16} />,
  WALK: <Icon.Walk width={16} height={16} />,
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
  bikeEnabled?: boolean;
};

/**
 * Planner form (UX audit C): one origin/destination block, ONE time control
 * (`Ahora ▾` popover with Salir a las / Llegar antes de + picker), one mode row that
 * fits on a phone, advanced toggles under "Más opciones", and the CTA pinned at the bottom.
 */
export function PlannerForm({ city, state, onChange, onSubmit, onUseLocation, onPickOnMap, picking, locating, userPos, compact, bikeEnabled = true }: Props) {
  const { t, lang } = useI18n();
  const canBike = bikeEnabled && city.modes.includes("BICYCLE");
  const [timeOpen, setTimeOpen] = useState(false);
  const [more, setMore] = useState(state.wheelchair || state.bike);
  const timeRef = useRef<HTMLDivElement>(null);

  const set = (patch: Partial<PlannerState>) => onChange({ ...state, ...patch, selected: null });
  const setPoint = (kind: "from" | "to", p: PlannerPoint | null) => set({ [kind]: p });

  useEffect(() => {
    if (!timeOpen) return;
    const onDoc = (e: PointerEvent) => {
      if (!timeRef.current?.contains(e.target as Node)) setTimeOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [timeOpen]);

  // Mode row: transit modes the city has + Bici (direct) + A pie
  const rowModes: Mode[] = [...TRANSIT_MODES.filter((m) => city.modes.includes(m)), ...(city.modes.includes("BICYCLE") ? (["BICYCLE"] as Mode[]) : []), "WALK"];
  const toggleMode = (m: Mode) => {
    const has = state.modes.includes(m);
    const next = has ? state.modes.filter((x) => x !== m) : [...state.modes, m];
    if (!next.length) return;
    if (m === "WALK" && has && !next.includes("BICYCLE")) return; // access on foot is implied
    set({ modes: next });
  };
  const shortLabel = (m: Mode) => (m === "BICYCLE" ? t.planner.modeBike : m === "WALK" ? t.planner.modeWalk : t.mode[m]);

  const timeValue = state.time ? toLocalInput(new Date(state.time), city.timezone) : toLocalInput(new Date(), city.timezone);
  const timeLabel = !state.time ? t.planner.timeNow : `${state.arriveBy ? t.planner.arriveBy : t.planner.departAt} ${fmtDateTime(state.time, city.timezone, lang)}`;

  const chip = (on: boolean, extra = "") =>
    `inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold ${on ? "border-ink bg-ink text-paper" : "border-line bg-paper-2 text-ink-2 hover:border-line-2"} ${extra}`;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {/* origin / destination */}
      <div className="relative flex flex-col gap-2">
        <PlaceInput city={city.id} kind="from" label={t.planner.from} placeholder={t.planner.fromPlaceholder} value={state.from} near={userPos ?? city.center} onChange={(p) => setPoint("from", p)} onUseLocation={() => onUseLocation("from")} onPickOnMap={() => onPickOnMap("from")} locating={locating === "from"} picking={picking === "from"} autoFocus={!compact && !state.from} />
        <PlaceInput city={city.id} kind="to" label={t.planner.to} placeholder={t.planner.toPlaceholder} value={state.to} near={userPos ?? city.center} onChange={(p) => setPoint("to", p)} onUseLocation={() => onUseLocation("to")} onPickOnMap={() => onPickOnMap("to")} locating={locating === "to"} picking={picking === "to"} />
        <button type="button" onClick={() => set({ from: state.to, to: state.from })} className="absolute -right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-paper-2 text-ink-2 shadow-sm hover:text-ink md:h-8 md:w-8" aria-label={t.planner.swap} title={t.planner.swap}>
          <Icon.Swap />
        </button>
      </div>

      {/* time: one control */}
      <div ref={timeRef} className="relative">
        <button type="button" onClick={() => setTimeOpen((o) => !o)} aria-expanded={timeOpen} aria-haspopup="dialog" className={chip(!!state.time, "max-w-full")}>
          <Icon.Clock width={16} height={16} />
          <span className="truncate">{timeLabel}</span>
          <Icon.Chevron width={14} height={14} className={`transition-transform ${timeOpen ? "-rotate-90" : "rotate-90"}`} />
        </button>
        {timeOpen ? (
          <div role="dialog" aria-label={t.planner.when} className="absolute left-0 top-full z-30 mt-1 w-[300px] max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-paper-2 p-3 shadow-card">
            <p className="mb-2 text-xs font-bold text-ink-2">{t.planner.when}</p>
            <div className="grid grid-cols-2 rounded-lg bg-paper-3 p-0.5 text-sm font-semibold">
              <button type="button" onClick={() => set({ time: state.time ?? fromLocalInput(timeValue, city.timezone), arriveBy: false })} className={`h-10 rounded-md ${!state.arriveBy ? "bg-paper-2 text-ink shadow-sm" : "text-ink-2"}`} aria-pressed={!state.arriveBy}>
                {t.planner.departAt}
              </button>
              <button type="button" onClick={() => set({ time: state.time ?? fromLocalInput(timeValue, city.timezone), arriveBy: true })} className={`h-10 rounded-md ${state.arriveBy ? "bg-paper-2 text-ink shadow-sm" : "text-ink-2"}`} aria-pressed={state.arriveBy}>
                {t.planner.arriveBy}
              </button>
            </div>
            <input type="datetime-local" aria-label={state.arriveBy ? t.planner.arriveBy : t.planner.departAt} className="mt-2 h-11 w-full rounded-lg border border-line bg-paper px-2 text-sm text-ink" value={timeValue} onChange={(e) => e.target.value && set({ time: fromLocalInput(e.target.value, city.timezone) })} />
            <div className="mt-2 flex justify-between">
              <button
                type="button"
                onClick={() => {
                  set({ time: null, arriveBy: false });
                  setTimeOpen(false);
                }}
                className="h-10 rounded-lg px-3 text-sm font-semibold text-ink-2 hover:bg-paper-3"
              >
                {t.planner.reset}
              </button>
              <button type="button" onClick={() => setTimeOpen(false)} className="h-10 rounded-lg bg-ink px-4 text-sm font-bold text-paper">
                {t.planner.done}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* modes: one row, no wrap */}
      <div className="flex gap-1.5" role="group" aria-label={t.planner.modes}>
        {rowModes.map((m) => {
          const on = state.modes.includes(m);
          return (
            <button key={m} type="button" aria-pressed={on} onClick={() => toggleMode(m)} className={chip(on, "flex-1 px-2")} title={t.mode[m]}>
              {MODE_ICON[m] ?? null}
              <span className="truncate">{shortLabel(m)}</span>
            </button>
          );
        })}
      </div>

      {/* more options */}
      <div>
        <button type="button" onClick={() => setMore((o) => !o)} aria-expanded={more} className="inline-flex h-10 items-center gap-1 text-sm font-semibold text-signal">
          <Icon.Chevron width={14} height={14} className={`transition-transform ${more ? "rotate-90" : ""}`} />
          {more ? t.planner.lessOptions : t.planner.moreOptions}
          {!more && (state.wheelchair || state.bike) ? <span className="ml-1 h-1.5 w-1.5 rounded-full bg-signal" aria-hidden /> : null}
        </button>
        {more ? (
          <div className="mt-1 flex flex-col divide-y divide-line rounded-xl border border-line bg-paper-2">
            {canBike ? (
              <Toggle on={state.bike} onChange={(v) => set({ bike: v })} icon={<Icon.Bike width={18} height={18} />} label={t.bike.toStation} hint={t.bike.hint} />
            ) : null}
            <Toggle on={state.wheelchair} onChange={(v) => set({ wheelchair: v })} icon={<Icon.Wheelchair width={18} height={18} />} label={t.planner.wheelchair} hint={t.planner.wheelchairHint} />
          </div>
        ) : null}
      </div>

      {/* pinned CTA */}
      <div className="sticky bottom-0 -mx-4 -mb-4 bg-gradient-to-t from-paper-2 via-paper-2 to-transparent px-4 pb-4 pt-3 md:static md:m-0 md:bg-none md:p-0">
        <Button type="submit" variant="primary" size="lg" disabled={!state.from || !state.to} className="w-full">
          <Icon.Search />
          {t.planner.search}
        </Button>
      </div>
    </form>
  );
}

function Toggle({ on, onChange, icon, label, hint }: { on: boolean; onChange: (v: boolean) => void; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
      <span className="text-ink-2">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {hint ? <span className="block text-[11px] leading-snug text-ink-3">{hint}</span> : null}
      </span>
      <input type="checkbox" role="switch" aria-checked={on} checked={on} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? "bg-signal" : "bg-line-2"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "left-0.5 translate-x-4" : "left-0.5"}`} />
      </span>
    </label>
  );
}
