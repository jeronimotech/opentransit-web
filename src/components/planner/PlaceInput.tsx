"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useGeocode } from "@/lib/api/hooks";
import { useT } from "@/lib/i18n/provider";
import { Icon, Spinner } from "@/components/ui/primitives";
import { componentColor } from "@/lib/colors";
import type { GeocodeResult } from "@/lib/api/types";
import { track } from "@/lib/analytics";
import type { PlannerPoint } from "@/lib/planner-params";
import { isTransitResult, otherField, placeGlyph, resultSubtitle, toPoint, type Field, type PlaceGlyph } from "@/lib/place-choice";

type Props = {
  city: string;
  label: string;
  placeholder: string;
  value: PlannerPoint | null;
  /** The other end of the trip, so a result can offer to fill it (and say what it would replace). */
  other?: PlannerPoint | null;
  near?: { lat: number; lon: number };
  onChange: (p: PlannerPoint | null) => void;
  /**
   * A deliberate choice for either field: the caller plans as soon as both ends are set.
   * Left out where there is no trip to fill (picking a favourite place), and then a
   * result only fills this field.
   */
  onPlace?: (field: Field, p: PlannerPoint) => void;
  onUseLocation?: () => void;
  onPickOnMap?: () => void;
  locating?: boolean;
  picking?: boolean;
  kind: Field;
  autoFocus?: boolean;
};

const GLYPH: Record<PlaceGlyph, (p: { width: number; height: number }) => React.ReactNode> = {
  station: (p) => <Icon.Station {...p} />,
  stop: (p) => <Icon.Station {...p} />,
  address: (p) => <Icon.Home {...p} />,
  street: (p) => <Icon.Street {...p} />,
  poi: (p) => <Icon.Services {...p} />,
  place: (p) => <Icon.Pin {...p} />,
};

export function PlaceInput({
  city,
  label,
  placeholder,
  value,
  other,
  near,
  onChange,
  onPlace,
  onUseLocation,
  onPickOnMap,
  locating,
  picking,
  kind,
  autoFocus,
}: Props) {
  const t = useT();
  const id = useId();
  const [text, setText] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const { data, isFetching } = useGeocode(city, query, near);
  const results = data?.results ?? [];

  // keep the text in sync when the value is set from outside (map click, swap, URL)
  useEffect(() => {
    setText(value?.name ?? (value ? `${value.lat.toFixed(4)}, ${value.lon.toFixed(4)}` : ""));
  }, [value?.name, value?.lat, value?.lon, value]);

  useEffect(() => {
    const h = setTimeout(() => setQuery(text.trim()), 200);
    return () => clearTimeout(h);
  }, [text]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  /** v2.1 — any result can fill either field, not only this one. */
  const pick = (r: GeocodeResult, field: Field, position = 0) => {
    // only what was CHOSEN, never the typed text; labels only for stops/POIs (addresses are personal)
    const labelled = r.type === "station" || r.type === "stop" || r.type === "poi";
    track("search_select", { resultType: r.type, resultId: r.stopId ?? undefined, label: labelled ? r.name : undefined, lat: r.lat, lon: r.lon, field, position });
    const p = toPoint(r);
    if (onPlace) onPlace(field, p);
    else onChange(p);
    if (field === kind) setText(r.name);
    setOpen(false);
  };

  const typeLabels: Record<PlaceGlyph, string> = {
    station: t.common.station,
    stop: t.common.stop,
    address: t.common.address,
    street: t.common.street,
    poi: t.common.poi,
    place: t.common.place,
  };
  const away = otherField(kind);
  const awayLabel = other
    ? away === "from"
      ? t.planner.replaceOrigin(other.name ?? "")
      : t.planner.replaceDestination(other.name ?? "")
    : away === "from"
      ? t.planner.setAsOrigin
      : t.planner.setAsDestination;

  return (
    <div ref={wrap} className="relative">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${kind === "from" ? "bg-ink text-paper" : "bg-signal text-signal-ink"}`}
        >
          {kind === "from" ? "A" : "B"}
        </span>
        <div className="relative flex-1">
          <label htmlFor={id} className="sr-only">
            {label}
          </label>
          <input
            id={id}
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            autoComplete="off"
            autoFocus={autoFocus}
            className="h-11 w-full rounded-lg border border-line bg-paper px-3 pr-9 text-[15px] font-medium text-ink placeholder:font-normal placeholder:text-ink-3 focus:border-signal focus:bg-paper-2"
            placeholder={placeholder}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              setActive(0);
              if (value && e.target.value !== value.name) onChange(null);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (!open || !results.length) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                pick(results[active], kind, active);
              } else if (e.key === "Escape") setOpen(false);
            }}
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3">
            {isFetching ? <Spinner /> : value ? <Icon.Check className="text-moss" /> : null}
          </span>
        </div>
      </div>

      {open && (text.trim().length >= 2 || onUseLocation) ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute left-8 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-paper-2 py-1 shadow-card"
        >
          {onUseLocation ? (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onUseLocation();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-signal hover:bg-paper-3"
              >
                {locating ? <Spinner /> : <Icon.Locate />}
                {locating ? t.planner.locating : t.planner.myLocation}
              </button>
            </li>
          ) : null}
          {onPickOnMap ? (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPickOnMap();
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-paper-3 ${picking ? "text-amber-ink bg-amber/40" : "text-signal"}`}
              >
                <Icon.Crosshair />
                {picking ? t.planner.pickDragHint : t.planner.pickOnMap}
              </button>
            </li>
          ) : null}
          {results.map((r, i) => {
            const glyph = placeGlyph(r);
            const transit = isTransitResult(r);
            return (
              <li key={r.id} role="option" aria-selected={i === active} className={`flex items-stretch ${i === active ? "bg-paper-3" : ""}`}>
                <button
                  type="button"
                  data-testid={`geocode-result-${glyph}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(r, kind, i)}
                  onMouseEnter={() => setActive(i)}
                  className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3 pr-1 text-left"
                >
                  {/* A stop keeps its component colour; a street or address must never look like one. */}
                  <span
                    aria-hidden
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${transit ? "text-white" : "border border-line bg-paper-3 text-ink-2"}`}
                    style={transit ? { background: componentColor(r.component) } : undefined}
                  >
                    {GLYPH[glyph]({ width: 16, height: 16 })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
                    <span className="block truncate text-xs text-ink-3">{resultSubtitle(r, typeLabels)}</span>
                  </span>
                </button>
                {/* the same result as the other end of the trip; the label says what it would replace */}
                {onPlace ? (
                <button
                  type="button"
                  data-testid={`geocode-use-as-${away}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(r, away, i)}
                  title={awayLabel}
                  aria-label={`${r.name} — ${awayLabel}`}
                  className="my-1 mr-1.5 grid w-9 shrink-0 place-items-center rounded-lg border border-line bg-paper-2 text-[11px] font-extrabold text-ink-2 hover:border-ink hover:text-ink"
                >
                  <span aria-hidden className={`grid h-5 w-5 place-items-center rounded-full ${away === "from" ? "bg-ink text-paper" : "bg-signal text-signal-ink"}`}>
                    {away === "from" ? "A" : "B"}
                  </span>
                </button>
                ) : null}
              </li>
            );
          })}
          {text.trim().length >= 2 && !isFetching && results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-3">{t.common.noMatches}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
