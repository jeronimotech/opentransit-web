"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { useCities } from "@/lib/api/hooks";
import { Icon } from "@/components/ui/primitives";
import { AdminShell } from "@/components/admin/AdminShell";
import { TokenGate } from "@/components/admin/TokenGate";

export default function AdminHome() {
  const { t } = useI18n();
  const cities = useCities();
  return (
    <TokenGate>
      {({ cities: allowed, logout }) => {
        const names = new Map((cities.data?.cities ?? []).map((c) => [c.id, c]));
        return (
          <AdminShell onLogout={logout}>
            <h1 className="text-2xl font-extrabold tracking-tight">{t.admin.title}</h1>
            <p className="mt-1 max-w-prose text-sm text-ink-2">{t.admin.subtitle}</p>
            <h2 className="mt-8 text-base font-bold">{t.admin.cities}</h2>
            <p className="text-sm text-ink-3">{t.admin.citiesHint}</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {allowed.map((id) => {
                const c = names.get(id);
                return (
                  <li key={id}>
                    <Link href={`/admin/${encodeURIComponent(id)}`} className="flex h-full items-center justify-between gap-3 rounded-card border border-line bg-paper-2 p-4 shadow-card hover:border-ink">
                      <span className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ background: c?.branding.primaryColor ?? "#999" }} />
                        <span>
                          <span className="block font-bold">{c?.name ?? id}</span>
                          <span className="block text-xs text-ink-3">{id}{c ? ` · ${c.country} · ${c.timezone}` : ""}</span>
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-signal">
                        {t.admin.open} <Icon.Chevron width={16} height={16} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </AdminShell>
        );
      }}
    </TokenGate>
  );
}
