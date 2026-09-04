"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { useTheme } from "@/lib/theme";
import { Icon } from "@/components/ui/primitives";
import { MOCK } from "@/lib/api/client";
import { resolveConfig } from "@/lib/city-config";
import type { City } from "@/lib/api/types";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <span aria-hidden className="grid h-6 w-6 place-items-center rounded-md bg-ink text-paper">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M4 14V6M10 14V6M16 14V6" />
          <path d="M4 10h12" />
        </svg>
      </span>
      <span>opentransit</span>
    </span>
  );
}

export function CityHeader({ city }: { city: City }) {
  const { t, lang, setLang } = useI18n();
  const { pref, setPref, resolved } = useTheme();
  const path = usePathname();
  const base = `/${city.id}`;
  const cfg = resolveConfig(city);
  const items = [
    { href: base, label: t.nav.plan, active: path === base || path.startsWith(`${base}/routes`), icon: null },
    ...(cfg.features.next ? [{ href: `${base}/next`, label: t.nav.next, active: path.startsWith(`${base}/next`), icon: null }] : []),
    ...(cfg.features.liveVehicles ? [{ href: `${base}/live`, label: t.nav.live, active: path.startsWith(`${base}/live`), icon: null }] : []),
    ...(cfg.features.alerts ? [{ href: `${base}/alerts`, label: t.nav.alerts, active: path.startsWith(`${base}/alerts`), icon: null }] : []),
    ...(cfg.features.favorites ? [{ href: `${base}/favorites`, label: t.nav.favorites, active: path.startsWith(`${base}/favorites`), icon: <Icon.Star width={16} height={16} /> }] : []),
  ];
  const toggleTheme = () => setPref(pref === "system" ? (resolved === "dark" ? "light" : "dark") : pref === "dark" ? "light" : "dark");

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2 md:p-4">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-line bg-paper-2/95 p-1 shadow-card backdrop-blur md:gap-1">
        <Link href="/" className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-paper-3 md:px-2" aria-label="opentransit">
          <Wordmark className="text-sm [&>span+*]:hidden sm:[&>span+*]:inline" />
        </Link>
        <span className="hidden h-5 w-px bg-line md:block" />
        <span
          className="hidden items-center gap-1.5 px-2 text-sm font-bold md:inline-flex"
          style={{ color: city.branding.primaryColor }}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: city.branding.primaryColor }} />
          {city.name}
        </span>
        <nav className="flex items-center gap-0.5 pl-1" aria-label="Secciones">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              aria-current={it.active ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-semibold md:px-2.5 ${it.active ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-3 hover:text-ink"}`}
              title={it.label}
            >
              {it.icon ? (
                <>
                  <span className="inline-block align-middle md:hidden">{it.icon}</span>
                  <span className="hidden md:inline">{it.label}</span>
                </>
              ) : (
                <span className={it.href.endsWith("/next") ? "hidden sm:inline" : ""}>{it.label}</span>
              )}
              {it.href.endsWith("/next") ? <span className="sm:hidden"><Icon.Bus width={16} height={16} className="inline-block align-middle" /></span> : null}
            </Link>
          ))}
        </nav>
      </div>

      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-line bg-paper-2/95 p-1 shadow-card backdrop-blur">
        {MOCK ? (
          <span className="hidden rounded-md bg-amber px-2 py-1 text-[11px] font-bold text-amber-ink sm:inline" title={t.common.mock}>
            demo
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setLang(lang === "es" ? "en" : "es")}
          className="rounded-lg px-2 py-1.5 text-xs font-bold text-ink-2 hover:bg-paper-3 hover:text-ink"
          aria-label={t.common.language}
        >
          {lang === "es" ? "EN" : "ES"}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-2 hover:bg-paper-3 hover:text-ink"
          aria-label={t.common.theme}
        >
          {resolved === "dark" ? <Icon.Sun /> : <Icon.Moon />}
        </button>
      </div>
    </header>
  );
}
