"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/primitives";

/**
 * Map fills the viewport. On desktop the panel floats at the left;
 * on small screens it becomes a bottom sheet with two positions.
 */
export function SplitLayout({
  map,
  panel,
  sheetOpen,
  onSheetOpenChange,
  panelWidth = "w-[420px]",
}: {
  map: ReactNode;
  panel: ReactNode;
  sheetOpen?: boolean;
  onSheetOpenChange?: (o: boolean) => void;
  panelWidth?: string;
}) {
  const t = useT();
  const [internalOpen, setInternalOpen] = useState(true);
  const open = sheetOpen ?? internalOpen;
  const setOpen = onSheetOpenChange ?? setInternalOpen;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && window.innerWidth < 768) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0">{map}</div>

      {/* Desktop panel */}
      <aside
        className={`panel-scroll absolute bottom-4 left-4 top-[68px] z-20 hidden ${panelWidth} overflow-y-auto rounded-xl border border-line bg-paper-2 shadow-card md:block`}
      >
        {panel}
      </aside>

      {/* Mobile sheet */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-t border-line bg-paper-2 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] transition-[max-height] duration-300 md:hidden ${open ? "max-h-[72dvh]" : "max-h-14"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-14 w-full shrink-0 items-center justify-center gap-2 text-sm font-semibold text-ink-2"
          aria-expanded={open}
          aria-label={open ? t.common.map : t.common.list}
        >
          <span className="h-1.5 w-10 rounded-full bg-line-2" />
          <span className="sr-only">{open ? t.common.map : t.common.list}</span>
        </button>
        <div className={`panel-scroll min-h-0 flex-1 overflow-y-auto ${open ? "" : "hidden"}`}>{panel}</div>
      </div>

      {/* Map/list toggle on mobile when sheet is closed */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute bottom-20 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper shadow-card md:hidden"
        >
          <Icon.List /> {t.common.list}
        </button>
      ) : null}
    </div>
  );
}
