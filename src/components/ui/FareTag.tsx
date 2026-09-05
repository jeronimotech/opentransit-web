"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { fmtMoney } from "@/lib/format";
import { Icon } from "./primitives";
import type { Fare } from "@/lib/api/types";

/** "Tarifa estimada $3.200" with the breakdown on hover/click (Maas pattern). */
export function FareTag({ fare, size = "sm", className = "", interactive = true }: { fare: Fare | null; size?: "sm" | "md"; className?: string; interactive?: boolean }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  if (!fare) return <span className={`text-ink-3 ${size === "sm" ? "text-xs" : "text-sm"} ${className}`}>{t.fare.unknown}</span>;
  const label = (l: string) => (l === "base" ? t.fare.base : l === "transfer" ? t.fare.transfer : l);
  const amount = fare.amount === 0 ? t.fare.free : fmtMoney(fare.amount, fare.currency, lang);
  if (!interactive) {
    // inside another button (itinerary card): plain text, tooltip on hover
    return (
      <span className={`inline-flex items-center gap-1 rounded-md bg-paper-3 px-1.5 py-0.5 font-semibold text-ink ${size === "sm" ? "text-xs" : "text-sm"} ${className}`} title={fare.estimated ? t.fare.note : undefined}>
        <Icon.Fare width={12} height={12} />
        {fare.estimated ? `${t.fare.estimated} · ` : `${t.planner.fare} · `}
        <span className="tabular-nums">{amount}</span>
        {fare.estimated ? <span aria-hidden>≈</span> : null}
      </span>
    );
  }
  return (
    <span className={`relative inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded-md bg-paper-3 px-1.5 py-0.5 font-semibold text-ink hover:bg-line ${size === "sm" ? "text-xs" : "text-sm"}`}
        title={fare.estimated ? t.fare.note : undefined}
      >
        <Icon.Fare width={12} height={12} />
        {fare.estimated ? `${t.fare.estimated} · ` : `${t.planner.fare} · `}
        <span className="tabular-nums">{amount}</span>
        {fare.estimated ? <span aria-hidden>≈</span> : null}
      </button>
      {open ? (
        <span role="tooltip" className="absolute left-0 top-full z-30 mt-1 w-64 rounded-lg border border-line bg-paper-2 p-2.5 text-xs shadow-card">
          <span className="mb-1 block font-semibold">{t.fare.breakdown}</span>
          {(fare.breakdown ?? []).map((b, i) => (
            <span key={i} className="flex justify-between gap-2">
              <span className="inline-flex items-center gap-1">
                {b.kind === "rental" ? <Icon.Bike width={12} height={12} className="text-ink-3" /> : null}
                {label(b.label)}
              </span>
              <span className="tabular-nums">{b.amount === 0 ? t.fare.free : fmtMoney(b.amount, fare.currency, lang)}</span>
            </span>
          ))}
          {fare.estimated ? <span className="mt-1.5 block text-ink-3">{t.fare.note}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
