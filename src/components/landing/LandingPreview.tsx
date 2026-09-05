"use client";

import { useEffect, useState } from "react";
import type { CityLanding, LandingResponse } from "@/lib/api/types";
import { clearLandingDraft, normalizeLanding, readLandingDraft } from "@/lib/landing";
import { LandingView } from "./LandingView";

/**
 * `?preview=1`: the admin tab wrote its unsaved draft to sessionStorage before opening this
 * tab; render it over the published data. Falls back to the published page when no draft.
 */
export function LandingPreview({ initial, appHref, city }: { initial: LandingResponse; appHref: string; city: string }) {
  const [data, setData] = useState<LandingResponse>(initial);
  const [hasDraft, setHasDraft] = useState(false);
  useEffect(() => {
    const draft: Partial<CityLanding> | null = readLandingDraft(city);
    if (!draft) return;
    setData({ ...initial, landing: normalizeLanding(draft) });
    setHasDraft(true);
  }, [city, initial]);
  return (
    <LandingView
      data={data}
      appHref={appHref}
      preview
      onClosePreview={() => {
        if (hasDraft) clearLandingDraft(city);
        window.close();
        setData(initial);
        setHasDraft(false);
      }}
    />
  );
}
