"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useGeocode } from "@/lib/api/hooks";
import { useT } from "@/lib/i18n/provider";
import { Icon, Spinner } from "@/components/ui/primitives";
import { componentColor } from "@/lib/colors";
import type { GeocodeResult } from "@/lib/api/types";
import type { PlannerPoint } from "@/lib/planner-params";

type Props = {
  city: string;
  label: string;
  placeholder: string;
  value: PlannerPoint | null;
  near?: { lat: number; lon: number };
  onChange: (p: PlannerPoint | null) => void;
  onUseLocation?: () => void;
  onPickOnMap?: () => void;
  locating?: boolean;
  picking?: boolean;
  kind: "from" | "to";
  autoFocus?: boolean;
};

export function PlaceInput({
  city,
  label,
  placeholder,
  value,
  near,
  onChange,
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

  const pick = (r: GeocodeResult) => {
    onChange({ lat: r.lat, lon: r.lon, name: r.name });
    setText(r.name);
    setOpen(false);
  };

  const typeLabel = (r: GeocodeResult) =>
    r.type === "station" ? t.common.station : r.type === "stop" ? t.common.stop : r.type === "address" ? t.common.address : r.type === "street" ? t.common.street : t.common.poi;

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
                pick(results[active]);
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
                <Icon.Pin />
                {picking ? t.planner.pickOnMapHint : t.planner.pickOnMap}
              </button>
            </li>
          ) : null}
          {results.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(r)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-start gap-3 px-3 py-2 text-left ${i === active ? "bg-paper-3" : ""}`}
              >
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: r.stopId ? componentColor(r.component) : "var(--ink-3)" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
                  <span className="block truncate text-xs text-ink-3">{r.label || typeLabel(r)}</span>
                </span>
              </button>
            </li>
          ))}
          {text.trim().length >= 2 && !isFetching && results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-3">{t.common.noMatches}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
