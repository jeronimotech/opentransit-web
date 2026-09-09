"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { fmtDateTime } from "@/lib/format";
import { Badge, Button, Icon, Spinner } from "@/components/ui/primitives";
import { AdminShell } from "@/components/admin/AdminShell";
import { AuthGate } from "@/components/admin/AuthGate";
import { canEdit, cityAllowed, type AdminUser } from "@/lib/admin/session";
import { ConfirmInline } from "@/components/admin/form";
import { useAdminConfig, useResetAll } from "@/components/admin/useAdmin";
import { FaresTab } from "@/components/admin/FaresTab";
import { ConfigTab } from "@/components/admin/ConfigTab";
import { LinksTab } from "@/components/admin/LinksTab";
import { ServicesTab } from "@/components/admin/ServicesTab";
import { MobilityTab } from "@/components/admin/MobilityTab";
import { BrandTab } from "@/components/admin/BrandTab";
import { LandingTab } from "@/components/admin/LandingTab";
import { AssistantTab } from "@/components/admin/AssistantTab";
import { HistoryTab } from "@/components/admin/HistoryTab";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";

const TABS = ["fares", "config", "links", "services", "mobility", "brand", "landing", "assistant", "analytics", "history"] as const;
type Tab = (typeof TABS)[number];

export default function AdminCityPage() {
  const params = useParams<{ city: string }>();
  const city = decodeURIComponent(params.city);
  return <AuthGate>{({ user, signOut }) => <AdminCity user={user} city={city} signOut={signOut} />}</AuthGate>;
}

function AdminCity({ user, city, signOut }: { user: AdminUser; city: string; signOut: () => void }) {
  const { t, lang } = useI18n();
  const allowed = cityAllowed(user, city);
  const editable = canEdit(user);
  const q = useAdminConfig(city, allowed);
  const resetAll = useResetAll(city);
  const [tab, setTab] = useState<Tab>("fares");
  const [confirmReset, setConfirmReset] = useState(false);
  // deep-linkable tabs without a Suspense boundary: /admin/bogota#config
  useEffect(() => {
    const h = window.location.hash.replace("#", "") as Tab;
    if (TABS.includes(h)) setTab(h);
  }, []);
  const pick = (x: Tab) => {
    setTab(x);
    history.replaceState(null, "", `#${x}`);
  };

  const data = q.data;
  const crumbs = (
    <>
      <Link href="/admin" className="hover:text-ink">{t.admin.cities}</Link>
      <Icon.Chevron width={14} height={14} />
      <span className="font-semibold text-ink">{data?.effective.name ?? city}</span>
    </>
  );

  return (
    <AdminShell user={user} onSignOut={signOut} crumbs={crumbs}>
      {!allowed ? (
        <p className="text-sm font-semibold text-brick">{t.admin.login.unauthorized}</p>
      ) : q.isLoading || !data ? (
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <Spinner /> {q.error ? String(q.error) : null}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: data.effective.branding.primaryColor }} />
                {data.effective.name}
              </h1>
              <p className="mt-1 text-sm text-ink-2" aria-live="polite">
                {data.revision > 0 ? (
                  <>
                    {t.admin.revision} <strong>{data.revision}</strong>
                    {data.updatedAt ? ` · ${t.admin.updated} ${fmtDateTime(data.updatedAt, data.effective.timezone, lang)}` : ""}
                    {data.updatedBy ? ` ${t.admin.by} ${data.updatedBy}` : ""}
                  </>
                ) : (
                  t.admin.never
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/${city}`} target="_blank" className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-signal hover:bg-paper-3">
                {t.admin.viewApp} <Icon.External width={14} height={14} />
              </Link>
              {data.override && editable ? (
                confirmReset ? (
                  <ConfirmInline message={t.admin.resetAllConfirm} onConfirm={() => { setConfirmReset(false); resetAll.mutate(); }} onCancel={() => setConfirmReset(false)} />
                ) : (
                  <Button size="sm" variant="danger" onClick={() => setConfirmReset(true)}>
                    {t.admin.resetAll}
                  </Button>
                )
              ) : null}
            </div>
          </div>

          <div role="tablist" aria-label={t.admin.title} className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
            {TABS.map((x) => {
              const active = tab === x;
              const overridden = x !== "history" && x !== "analytics" && !!data.override?.[x === "brand" ? "branding" : x === "assistant" ? "config" : x];
              return (
                <button key={x} role="tab" aria-selected={active} aria-controls={`panel-${x}`} id={`tab-${x}`} type="button" onClick={() => pick(x)} className={`-mb-px flex h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-semibold ${active ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}>
                  {t.admin.tabs[x]}
                  {overridden ? <Badge tone="info">•</Badge> : null}
                </button>
              );
            })}
          </div>
          <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-5">
            {tab === "fares" ? <FaresTab city={city} data={data} /> : null}
            {tab === "config" ? <ConfigTab city={city} data={data} /> : null}
            {tab === "links" ? <LinksTab city={city} data={data} /> : null}
            {tab === "services" ? <ServicesTab city={city} data={data} /> : null}
            {tab === "mobility" ? <MobilityTab city={city} data={data} /> : null}
            {tab === "brand" ? <BrandTab city={city} data={data} /> : null}
            {tab === "landing" ? <LandingTab city={city} data={data} /> : null}
            {tab === "assistant" ? <AssistantTab city={city} data={data} /> : null}
            {tab === "analytics" ? <AnalyticsTab city={city} data={data} /> : null}
            {tab === "history" ? <HistoryTab city={city} data={data} /> : null}
          </div>
        </>
      )}
    </AdminShell>
  );
}
