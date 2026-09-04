"use client";

import { useT } from "@/lib/i18n/provider";
import { freshnessLabel } from "@/lib/freshness";
import type { Freshness } from "@/lib/api/types";

export type StatusTone = "live" | "scheduled" | "estimated" | "stale";

const DOT: Record<StatusTone, string> = {
  live: "bg-moss",
  scheduled: "bg-ink-3",
  estimated: "bg-signal",
  stale: "bg-amber",
};
const TEXT: Record<StatusTone, string> = {
  live: "text-moss",
  scheduled: "text-ink-3",
  estimated: "text-signal",
  stale: "text-ink-2",
};

/**
 * The one style for data-freshness text everywhere (UX audit E): a dot + short label,
 * never a filled pill next to another pill. Announced politely for screen readers.
 */
export function StatusText({ tone, label, hint, className = "", live = true }: { tone: StatusTone; label: string; hint?: string; className?: string; live?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold ${TEXT[tone]} ${className}`} title={hint} aria-live={live ? "polite" : undefined}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[tone]} ${tone === "live" ? "live-dot-soft" : ""}`} aria-hidden />
      {label}
    </span>
  );
}

/**
 * "Programado / En vivo / Sin datos en vivo hace N s".
 * `realtime` describes the row; `freshness` describes the feed.
 */
export function FreshnessBadge({ freshness, realtime, className = "" }: { freshness?: Freshness | null; realtime: boolean | null; className?: string }) {
  const t = useT();
  const { tone, label } = freshnessLabel(t, freshness, realtime);
  const hint = tone === "live" ? t.freshness.liveHint : tone === "stale" ? t.freshness.staleHint : t.freshness.scheduledHint;
  return <StatusText tone={tone} label={label} hint={hint} className={className} />;
}
