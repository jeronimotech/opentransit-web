"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Plain-SVG chart primitives for the admin analytics tab, built to the dataviz method:
 * one sequential hue for magnitude, a fixed categorical order (never cycled past 8),
 * thin marks with 4 px rounded data-ends, 2 px surface gaps, hover tooltips, recessive
 * grid, text always in ink tokens (never the series colour), and a table view for
 * every chart (identity is never colour-alone).
 */

/** Categorical slots (reference palette, light/dark selected via CSS vars in globals.css). */
export const SERIES = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-5)", "var(--viz-6)", "var(--viz-7)", "var(--viz-8)"];
export const STATUS = { good: "var(--viz-good)", warning: "var(--viz-warning)", serious: "var(--viz-serious)" };

export const fmtInt = (n: number, lang: string) => new Intl.NumberFormat(lang === "es" ? "es-CO" : "en-US", { maximumFractionDigits: 0 }).format(n);

/* ── stat tile ── */
export function KpiTile({ label, value, previous, lang, vsLabel }: { label: string; value: number; previous: number | null; lang: string; vsLabel: string }) {
  const delta = previous && previous > 0 ? (value - previous) / previous : null;
  const tone = delta === null ? "neutral" : delta >= 0.02 ? "up" : delta <= -0.02 ? "down" : "flat";
  return (
    <div className="rounded-card border border-line bg-paper-2 px-4 py-3" data-testid="kpi">
      <p className="text-xs font-semibold text-ink-2">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight">{fmtInt(value, lang)}</p>
      {delta !== null ? (
        <p className="mt-0.5 flex items-center gap-1 text-xs tabular-nums text-ink-3">
          <span className={`inline-flex items-center gap-0.5 font-semibold ${tone === "up" ? "text-live" : tone === "down" ? "text-severe" : "text-ink-2"}`} aria-label={`${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}%`}>
            {tone === "up" ? "▲" : tone === "down" ? "▼" : "•"} {Math.abs(Math.round(delta * 100))}%
          </span>
          {vsLabel}
        </p>
      ) : null}
    </div>
  );
}

/* ── shared chrome ── */
export function ChartCard({ title, hint, children, table, tableLabel, chartLabel, actions }: { title: string; hint?: string; children: ReactNode; table?: ReactNode; tableLabel: string; chartLabel: string; actions?: ReactNode }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="rounded-card border border-line bg-paper-2 shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          {hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {table ? (
            <button type="button" onClick={() => setShowTable((v) => !v)} className="h-8 rounded-md border border-line px-2 text-xs font-semibold text-ink-2 hover:text-ink" aria-pressed={showTable}>
              {showTable ? chartLabel : tableLabel}
            </button>
          ) : null}
        </div>
      </header>
      <div className="p-4">{showTable && table ? table : children}</div>
    </section>
  );
}

export function Tip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div role="tooltip" className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-paper-2 px-2 py-1 text-xs shadow-card" style={{ left: x, top: y - 6 }}>
      {children}
    </div>
  );
}

/* ── horizontal bar list (magnitude, one hue) ── */
export function BarList({ rows, lang, max: maxIn }: { rows: { key: string; label: ReactNode; value: number; sub?: string }[]; lang: string; max?: number }) {
  const max = maxIn ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_auto] items-center gap-3 text-sm">
          <span className="min-w-0 truncate">{r.label}</span>
          <span className="relative h-3 rounded-[4px] bg-paper-3" aria-hidden>
            <span className="absolute inset-y-0 left-0 rounded-[4px]" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: "var(--viz-seq-6)" }} />
          </span>
          <span className="tabular-nums text-right text-ink">
            {fmtInt(r.value, lang)}
            {r.sub ? <span className="ml-1 text-xs text-ink-3">{r.sub}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ── heatmap: weekday × hour, sequential ramp ── */
export function Heatmap({ cells, weekdays, lang, ariaLabel }: { cells: { weekday: number; hour: number; value: number }[]; weekdays: readonly string[]; lang: string; ariaLabel: string }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const max = Math.max(1, ...cells.map((c) => c.value));
  const W = 24, H = 7, cw = 28, ch = 22, left = 36, top = 18;
  const step = (v: number) => (v <= 0 ? "var(--paper-3)" : `var(--viz-seq-${Math.min(9, 2 + Math.round((v / max) * 7))})`);
  const id = useId();
  return (
    <div className="relative overflow-x-auto">
      <svg width={left + W * cw} height={top + H * ch + 4} role="img" aria-labelledby={id} className="block">
        <title id={id}>{ariaLabel}</title>
        {Array.from({ length: W }, (_, h) => (
          <text key={h} x={left + h * cw + cw / 2} y={12} textAnchor="middle" fontSize="10" fill="var(--ink-3)">
            {h % 3 === 0 ? `${h}h` : ""}
          </text>
        ))}
        {weekdays.map((d, i) => (
          <text key={d} x={left - 6} y={top + i * ch + ch / 2 + 4} textAnchor="end" fontSize="11" fill="var(--ink-2)" fontWeight={600}>
            {d}
          </text>
        ))}
        {cells.map((c) => (
          <rect
            key={`${c.weekday}-${c.hour}`}
            x={left + c.hour * cw + 1}
            y={top + c.weekday * ch + 1}
            width={cw - 2}
            height={ch - 2}
            rx={4}
            fill={step(c.value)}
            onMouseEnter={(e) => setTip({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, text: `${weekdays[c.weekday]} ${c.hour}:00 · ${fmtInt(c.value, lang)}` })}
            onMouseLeave={() => setTip(null)}
          />
        ))}
      </svg>
      {tip ? <Tip x={tip.x} y={tip.y}>{tip.text}</Tip> : null}
    </div>
  );
}

/* ── stacked / grouped horizontal bars for two measures per category ── */
export function PairedBars({ rows, lang, labels }: { rows: { key: string; label: string; a: number; b: number }[]; lang: string; labels: [string, string] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b]));
  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[0] }} />{labels[0]}</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[1] }} />{labels[1]}</span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)_auto] items-center gap-3 text-sm">
            <span className="min-w-0 truncate font-mono text-xs" title={r.label}>{r.label}</span>
            <span className="flex flex-col gap-0.5" aria-hidden>
              <span className="h-2.5 rounded-[4px]" style={{ width: `${Math.max(1.5, (r.a / max) * 100)}%`, background: SERIES[0] }} />
              <span className="h-2.5 rounded-[4px]" style={{ width: `${Math.max(1.5, (r.b / max) * 100)}%`, background: SERIES[1] }} />
            </span>
            <span className="text-right text-xs tabular-nums text-ink-2">
              {fmtInt(r.a, lang)} · {fmtInt(r.b, lang)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── funnel: successive steps as proportional bars ── */
export function Funnel({ steps, lang }: { steps: { key: string; label: string; value: number }[]; lang: string }) {
  const max = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s, i) => {
        const prev = steps[i - 1]?.value ?? s.value;
        const conv = prev > 0 ? Math.round((s.value / prev) * 100) : 100;
        return (
          <li key={s.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)_auto] items-center gap-3 text-sm">
            <span className="truncate">{s.label}</span>
            <span className="relative h-5 rounded-[4px] bg-paper-3" aria-hidden>
              <span className="absolute inset-y-0 left-0 rounded-[4px]" style={{ width: `${Math.max(2, (s.value / max) * 100)}%`, background: `var(--viz-seq-${Math.max(3, 8 - i)})` }} />
            </span>
            <span className="text-right tabular-nums">
              {fmtInt(s.value, lang)}
              {i > 0 ? <span className="ml-1 text-xs text-ink-3">{conv}%</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ── generic table for the "Ver tabla" toggle ── */
export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-ink-3">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={`px-2 py-1.5 ${typeof c === "number" ? "text-right tabular-nums" : ""}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
