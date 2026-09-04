"use client";

import { useT } from "@/lib/i18n/provider";
import { Icon } from "./primitives";
import type { City } from "@/lib/api/types";

/** Hand-off to the agency's official channels (PQRS, support). Never a form of our own. */
export function PqrsLink({ city, compact = false, className = "" }: { city: City; compact?: boolean; className?: string }) {
  const t = useT();
  const url = city.links?.pqrs;
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className={`inline-flex items-center gap-1.5 font-semibold text-signal hover:underline ${compact ? "text-xs" : "text-sm"} ${className}`}
      title={t.links.external}
    >
      <Icon.Flag width={compact ? 12 : 14} height={compact ? 12 : 14} />
      {t.links.pqrs}
      <Icon.External width={compact ? 10 : 12} height={compact ? 10 : 12} className="text-ink-3" />
    </a>
  );
}
