"use client";

import { useT } from "@/lib/i18n/provider";
import { freshnessLabel } from "@/lib/freshness";
import { Badge } from "./primitives";
import type { Freshness } from "@/lib/api/types";

/**
 * The one way we say "Programado / En vivo / Sin datos en vivo hace N s".
 * `realtime` describes the row; `freshness` describes the feed.
 */
export function FreshnessBadge({ freshness, realtime, className = "" }: { freshness?: Freshness | null; realtime: boolean | null; className?: string }) {
  const t = useT();
  const { tone, label } = freshnessLabel(t, freshness, realtime);
  const hint = tone === "live" ? t.freshness.liveHint : tone === "stale" ? t.freshness.staleHint : t.freshness.scheduledHint;
  return (
    <Badge tone={tone === "live" ? "live" : tone === "stale" ? "warn" : "neutral"} className={className}>
      {tone === "live" ? <span className="live-dot" style={{ width: 5, height: 5 }} /> : null}
      <span title={hint}>{label}</span>
    </Badge>
  );
}
