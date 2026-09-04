"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/primitives";

/**
 * The map is the product (UX audit, principle 1). Desktop: the panel floats at the left.
 * Phones: a draggable bottom sheet with three snap points — peek 24 %, half 55 %, full 92 %
 * of the viewport — so the map keeps ≥ 45 % of the screen unless the person pulls the sheet up.
 * `mode="strip"` (stop pages) shows a short map strip above scrolling content instead,
 * with a "Ver en mapa" toggle that expands the map.
 */
export type Snap = "peek" | "half" | "full";
export const SNAP_HEIGHTS: Record<Snap, number> = { peek: 0.24, half: 0.55, full: 0.92 };
const ORDER: Snap[] = ["peek", "half", "full"];

type SheetCtx = { snap: Snap; setSnap: (s: Snap) => void; isPhone: boolean; expanded: boolean };
const Ctx = createContext<SheetCtx>({ snap: "half", setSnap: () => {}, isPhone: false, expanded: true });
export function useSheet() {
  return useContext(Ctx);
}

export function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

export function SplitLayout({
  map,
  panel,
  snap: snapProp,
  onSnapChange,
  defaultSnap = "half",
  mode = "sheet",
  panelWidth = "w-[420px]",
  overlay,
  stripLabels,
}: {
  map: ReactNode;
  panel: ReactNode;
  snap?: Snap;
  onSnapChange?: (s: Snap) => void;
  defaultSnap?: Snap;
  mode?: "sheet" | "strip";
  panelWidth?: string;
  /** Rendered over the map on phones only (search pill, etc.). */
  overlay?: ReactNode;
  stripLabels?: { expand: string; collapse: string };
}) {
  const t = useT();
  const isPhone = useIsPhone();
  const [internal, setInternal] = useState<Snap>(defaultSnap);
  const snap = snapProp ?? internal;
  const setSnap = useCallback(
    (s: Snap) => {
      setInternal(s);
      onSnapChange?.(s);
    },
    [onSnapChange],
  );
  const [stripOpen, setStripOpen] = useState(false);

  // drag state
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startY: number; startH: number; moved: boolean } | null>(null);
  const [dragH, setDragH] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const vh = () => (typeof window === "undefined" ? 800 : window.innerHeight);
  const heightFor = (s: Snap) => Math.round(vh() * SNAP_HEIGHTS[s]);
  const nearest = (h: number): Snap => {
    let best: Snap = "peek";
    let d = Infinity;
    for (const s of ORDER) {
      const dd = Math.abs(heightFor(s) - h);
      if (dd < d) {
        d = dd;
        best = s;
      }
    }
    return best;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isPhone) return;
    // when fully open, only the handle drags (content needs to scroll)
    const target = e.target as HTMLElement;
    if (snap === "full" && !target.closest("[data-sheet-handle]")) return;
    dragRef.current = { startY: e.clientY, startH: heightFor(snap), moved: false };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 4) d.moved = true;
    setDragH(Math.max(heightFor("peek") * 0.8, Math.min(vh() * 0.95, d.startH - dy)));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!d) return;
    if (!d.moved) {
      // tap on the handle cycles peek → half → full → peek
      const target = e.target as HTMLElement;
      if (target.closest("[data-sheet-handle]")) setSnap(snap === "full" ? "peek" : snap === "peek" ? "half" : "full");
      setDragH(null);
      return;
    }
    const h = dragH ?? d.startH;
    setDragH(null);
    setSnap(nearest(h));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && window.innerWidth < 768) setSnap("peek");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSnap]);

  const sheetHeight = dragH ?? (typeof window === "undefined" ? undefined : heightFor(snap));
  const sheetVar = dragH != null ? `${dragH}px` : `${Math.round(SNAP_HEIGHTS[snap] * 100)}dvh`;
  const ctx: SheetCtx = { snap, setSnap, isPhone, expanded: !isPhone || snap !== "peek" };

  if (mode === "strip") {
    return (
      <Ctx.Provider value={{ ...ctx, expanded: true }}>
        <div className="relative h-dvh w-full overflow-hidden md:block" style={{ "--sheet-h": "0px" } as React.CSSProperties}>
          {/* Desktop: side-by-side */}
          <div className="absolute inset-0 hidden md:block">{map}</div>
          <aside className={`panel-scroll absolute bottom-4 left-4 top-[68px] z-20 hidden ${panelWidth} overflow-y-auto rounded-xl border border-line bg-paper-2 shadow-card md:block`}>{panel}</aside>

          {/* Phone: strip + scrolling content, or expanded map */}
          <div className="flex h-full flex-col md:hidden">
            <div className={`relative shrink-0 transition-[height] duration-300 ${stripOpen ? "flex-1" : "h-[188px]"}`}>
              <div className="absolute inset-0">{map}</div>
              <button
                type="button"
                onClick={() => setStripOpen((o) => !o)}
                className="absolute bottom-3 right-3 z-10 inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-paper-2/95 px-4 text-sm font-bold text-ink shadow-card backdrop-blur"
                aria-expanded={stripOpen}
              >
                {stripOpen ? <Icon.List width={18} height={18} /> : <Icon.Map width={18} height={18} />}
                {stripOpen ? (stripLabels?.collapse ?? t.common.list) : (stripLabels?.expand ?? t.common.map)}
              </button>
            </div>
            <div className={`panel-scroll min-h-0 flex-1 overflow-y-auto bg-paper-2 ${stripOpen ? "hidden" : ""}`} style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
              {panel}
            </div>
          </div>
        </div>
      </Ctx.Provider>
    );
  }

  return (
    <Ctx.Provider value={ctx}>
      <div className="relative h-dvh w-full overflow-hidden" style={{ "--sheet-h": isPhone ? sheetVar : "0px" } as React.CSSProperties}>
        <div className="absolute inset-0">{map}</div>
        {overlay ? <div className="md:hidden">{overlay}</div> : null}

        {/* Desktop panel */}
        <aside className={`panel-scroll absolute bottom-4 left-4 top-[68px] z-20 hidden ${panelWidth} overflow-y-auto rounded-xl border border-line bg-paper-2 shadow-card md:block`}>{panel}</aside>

        {/* Phone sheet */}
        <div
          ref={sheetRef}
          className={`absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-t border-line bg-paper-2 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] md:hidden ${dragging ? "" : "transition-[height] duration-300 ease-out motion-reduce:transition-none"}`}
          style={{ height: sheetHeight, paddingBottom: "env(safe-area-inset-bottom)", touchAction: snap === "full" ? "auto" : "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="region"
          aria-label={t.common.list}
        >
          <div data-sheet-handle className="flex h-7 w-full shrink-0 cursor-grab items-center justify-center active:cursor-grabbing" aria-hidden>
            <span className="h-1.5 w-10 rounded-full bg-line-2" />
          </div>
          <div className={`panel-scroll min-h-0 flex-1 ${snap === "full" ? "overflow-y-auto" : "overflow-hidden"}`}>{panel}</div>
        </div>
      </div>
    </Ctx.Provider>
  );
}
