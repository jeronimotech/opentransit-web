"use client";

import { useEffect, useState } from "react";
import type { CityLanding, LandingResponse } from "@/lib/api/types";
import { LANDING_DRAFT_KEY, normalizeLanding } from "@/lib/landing";
import { LandingView } from "./LandingView";

/**
 * `?preview=1`: the admin tab wrote its unsaved draft to sessionStorage before opening this
 * tab; render it over the published data. Falls back to the published page when no draft.
 */
export function LandingPreview({ initial, appHref, city }: { initial: LandingResponse; appHref: string; city: string }) {
  const [data, setData] = useState<LandingResponse>(initial);
  const [hasDraft, setHasDraft] = useState(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LANDING_DRAFT_KEY(city));
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<CityLanding>;
      setData({ ...initial, landing: normalizeLanding(draft) });
      setHasDraft(true);
    } catch {
      /* no usable draft */
    }
  }, [city, initial]);
  return (
    <LandingView
      data={data}
      appHref={appHref}
      preview
      onClosePreview={() => {
        if (hasDraft) {
          try {
            sessionStorage.removeItem(LANDING_DRAFT_KEY(city));
          } catch {
            /* ignore */
          }
        }
        window.close();
        setData(initial);
        setHasDraft(false);
      }}
    />
  );
}
