"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useAnalyticsSettings } from "@/lib/analytics";
import { defaultOptIn } from "@/lib/analytics/core";
import { Button } from "@/components/ui/primitives";

/** Settings block: the one-sentence promise, the toggle, and "Borrar mis estadísticas". */
export function AnalyticsSettings() {
  const { t } = useI18n();
  const { optIn, queued, setOptIn, clear } = useAnalyticsSettings();
  const [cleared, setCleared] = useState(false);
  const browserOff = typeof navigator !== "undefined" && !defaultOptIn(navigator as Navigator & { globalPrivacyControl?: boolean });
  return (
    <section className="mt-10 rounded-card border border-line bg-paper-2 p-4" data-testid="analytics-settings">
      <h2 className="text-lg font-bold">{t.analytics.title}</h2>
      <label className="mt-3 flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--signal)]" data-testid="analytics-toggle" />
        <span>
          <span className="block text-sm font-semibold">{t.analytics.toggle}</span>
          <span className="block text-sm text-ink-2">{t.analytics.hint}</span>
          {browserOff && !optIn ? <span className="mt-1 block text-xs text-ink-3">{t.analytics.off}</span> : null}
        </span>
      </label>
      <details className="mt-3 text-sm text-ink-2">
        <summary className="cursor-pointer font-semibold text-ink">{t.analytics.privacy}</summary>
        <p className="mt-1">{t.analytics.privacyText}</p>
      </details>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            clear();
            setCleared(true);
            setTimeout(() => setCleared(false), 2500);
          }}
        >
          {t.analytics.clear}
        </Button>
        <span className="text-xs text-ink-3" aria-live="polite">{cleared ? t.analytics.cleared : t.analytics.queued(queued)}</span>
      </div>
    </section>
  );
}
