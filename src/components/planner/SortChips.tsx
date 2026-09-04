"use client";

import { useT } from "@/lib/i18n/provider";
import { SORT_KEYS, type SortKey } from "@/lib/sort";

/** Maas-style result sorting. `cheapest` only shows when the city publishes fare parameters. */
export function SortChips({ value, onChange, hasFares }: { value: SortKey; onChange: (k: SortKey) => void; hasFares: boolean }) {
  const t = useT();
  const keys = SORT_KEYS.filter((k) => k !== "cheapest" || hasFares);
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]" role="group" aria-label={t.sort.label}>
      <div className="flex w-max gap-1.5">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            onClick={() => onChange(k)}
            className={`h-7 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold ${value === k ? "border-ink bg-ink text-paper" : "border-line bg-paper-2 text-ink-2 hover:border-line-2"}`}
          >
            {t.sort[k]}
          </button>
        ))}
      </div>
    </div>
  );
}
