"use client";

import { cleanHeadsign } from "@/lib/text";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCityCtx } from "@/components/shell/CityContext";
import { EmptyState, Spinner, inputCls } from "@/components/ui/primitives";
import { RouteChip } from "@/components/ui/RouteChip";
import { ComponentIcon } from "@/components/ui/ComponentIcon";
import { useI18n } from "@/lib/i18n/provider";
import { useRoutes } from "@/lib/api/hooks";
import { componentsOf } from "@/lib/city-config";
import { serviceStatus } from "@/lib/service-window";
import type { Component } from "@/lib/api/types";

/** Route finder: by code or name, filtered by component, with service hours. */
export default function RoutesPage() {
  const city = useCityCtx();
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [comp, setComp] = useState<Component | "">("");
  useEffect(() => {
    const h = setTimeout(() => setQ(text.trim()), 200);
    return () => clearTimeout(h);
  }, [text]);
  const { data, isLoading, error } = useRoutes(city.id, comp || undefined, q || undefined);
  const comps = componentsOf(city);
  const routes = useMemo(() => {
    const list = data?.routes ?? [];
    const n = q.toLowerCase();
    // the API filters too, but keep the list responsive between debounces
    return list.filter((r) => !n || `${r.shortName} ${r.longName}`.toLowerCase().includes(n)).slice(0, 200);
  }, [data, q]);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-24 md:pt-28">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t.route.search}</h1>
      <input className={`${inputCls} mt-4 h-11 text-[15px]`} placeholder={t.route.searchPlaceholder} value={text} onChange={(e) => setText(e.target.value)} autoFocus aria-label={t.route.search} />
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={comp === ""} onClick={() => setComp("")} className={`h-8 rounded-full border px-3 text-xs font-semibold ${comp === "" ? "border-ink bg-ink text-paper" : "border-line bg-paper-2 text-ink-2"}`}>
          {t.route.all}
        </button>
        {comps.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={comp === c.id}
            onClick={() => setComp(comp === c.id ? "" : c.id)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${comp === c.id ? "border-transparent text-white" : "border-line bg-paper-2 text-ink-2"}`}
            style={comp === c.id ? { background: c.color } : undefined}
          >
            <ComponentIcon icon={c.icon} width={14} height={14} style={comp === c.id ? undefined : { color: c.color }} />
            {c.label}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {isLoading ? <Spinner /> : null}
        {error ? <EmptyState title={t.common.error} /> : null}
        {!isLoading && !routes.length ? <EmptyState title={t.route.none} /> : null}
        <ul className="divide-y divide-line rounded-card border border-line bg-paper-2">
          {routes.map((r) => {
            const svc = serviceStatus(t, r);
            return (
              <li key={r.id}>
                <Link href={`/${city.id}/routes/${encodeURIComponent(r.id)}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-paper-3">
                  <RouteChip route={r} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{cleanHeadsign(r.longName)}</span>
                    <span className={`block truncate text-xs ${svc.active === false ? "font-semibold text-brick" : "text-ink-3"}`}>{svc.label ?? t.component[r.component]}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
