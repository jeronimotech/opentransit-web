"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useHealth } from "@/lib/api/hooks";
import { Icon } from "@/components/ui/primitives";

/**
 * Slim top bar for connectivity and feed freshness (Citymapper pattern): red while
 * offline, a green flash when back, amber when the live feed is stale. Inline text
 * inside the lists no longer has to explain it.
 */
export function NetBar({ city }: { city: string }) {
  const { t } = useI18n();
  const [online, setOnline] = useState(true);
  const [flash, setFlash] = useState(false);
  const health = useHealth(city, online);
  useEffect(() => {
    setOnline(navigator.onLine);
    const off = () => setOnline(false);
    const on = () => {
      setOnline(true);
      setFlash(true);
      setTimeout(() => setFlash(false), 2500);
    };
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, []);
  const stale = online && health.data?.realtime?.enabled !== false && health.data?.realtime?.stale;
  if (!online) return <Bar tone="severe" icon={<Icon.Alert width={14} height={14} />} text={t.lote1.offline} />;
  if (flash) return <Bar tone="live" icon={<Icon.Check width={14} height={14} />} text={t.lote1.backOnline} />;
  if (stale) return <Bar tone="disruption" icon={<Icon.Clock width={14} height={14} />} text={t.lote1.staleBar(health.data?.realtime?.staleSeconds ?? health.data?.realtime?.entityAgeP50Seconds ?? 0)} />;
  return null;
}

function Bar({ tone, icon, text }: { tone: "severe" | "live" | "disruption"; icon: React.ReactNode; text: string }) {
  const cls = tone === "severe" ? "bg-severe text-white" : tone === "live" ? "bg-live text-white" : "bg-disruption text-white";
  return (
    <div role="status" aria-live="polite" className={`fixed inset-x-0 top-0 z-40 flex h-7 items-center justify-center gap-1.5 text-xs font-semibold ${cls}`} data-testid={`netbar-${tone}`}>
      {icon}
      {text}
    </div>
  );
}
