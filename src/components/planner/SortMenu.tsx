"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/primitives";
import { SORT_KEYS, type SortKey } from "@/lib/sort";

/**
 * Sorting demoted to a secondary "Ordenar" menu (Citymapper): the scenario sections
 * carry the comparison; this only re-orders inside them.
 */
export function SortMenu({ value, onChange, hasFares }: { value: SortKey; onChange: (k: SortKey) => void; hasFares: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const keys = SORT_KEYS.filter((k) => k !== "cheapest" || hasFares);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-paper-2 px-2.5 text-xs font-semibold text-ink-2 hover:border-line-2 hover:text-ink">
        <Icon.Chevron width={12} height={12} className="rotate-90" />
        {t.lote1.sortMenu}
        {value !== "default" ? <span className="text-ink">· {t.sort[value]}</span> : null}
      </button>
      {open ? (
        <ul role="menu" className="absolute right-0 z-20 mt-1 min-w-44 rounded-card border border-line bg-paper-2 p-1 shadow-card">
          {keys.map((k) => (
            <li key={k} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={value === k}
                onClick={() => {
                  onChange(k);
                  setOpen(false);
                }}
                className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm ${value === k ? "bg-paper-3 font-semibold" : "hover:bg-paper-3"}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${value === k ? "bg-ink" : "bg-transparent"}`} />
                {t.sort[k]}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
