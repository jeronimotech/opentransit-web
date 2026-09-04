"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

/**
 * Floating header. Desktop: wordmark · city · section nav · language · theme.
 * Phones (UX audit A/F): wordmark + city dot + ONE menu button, so the map keeps
 * at most a handful of controls over it.
 */
export function CityHeader({ city }: { city: City }) {
  const { t, lang, setLang } = useI18n();
  const { pref, setPref, resolved } = useTheme();
  const path = usePathname();
  const base = `/${city.id}`;
  const cfg = resolveConfig(city);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const items = [
    { href: base, label: t.nav.plan, active: path === base || path.startsWith(`${base}/routes`), icon: <Icon.Route width={18} height={18} /> },
    ...(cfg.features.next ? [{ href: `${base}/next`, label: t.nav.next, active: path.startsWith(`${base}/next`), icon: <Icon.Bus width={18} height={18} /> }] : []),
    ...(cfg.features.liveVehicles ? [{ href: `${base}/live`, label: t.nav.live, active: path.startsWith(`${base}/live`), icon: <Icon.Map width={18} height={18} /> }] : []),
    ...(cfg.features.alerts ? [{ href: `${base}/alerts`, label: t.nav.alerts, active: path.startsWith(`${base}/alerts`), icon: <Icon.Alert width={18} height={18} /> }] : []),
    ...(cfg.features.favorites ? [{ href: `${base}/favorites`, label: t.nav.favorites, active: path.startsWith(`${base}/favorites`), icon: <Icon.Star width={18} height={18} /> }] : []),
  ];
  const toggleTheme = () => setPref(pref === "system" ? (resolved === "dark" ? "light" : "dark") : pref === "dark" ? "light" : "dark");

  useEffect(() => setMenu(false), [path]);
  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [menu]);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2 md:p-4">
      {/* Desktop */}
      <div className="pointer-events-auto hidden items-center gap-1 rounded-xl border border-line bg-paper-2/95 p-1 shadow-card backdrop-blur md:flex">
        <Link href="/" className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-paper-3" aria-label="opentransit">
          <Wordmark className="text-sm" />
        </Link>
        <span className="h-5 w-px bg-line" />
        <span className="inline-flex items-center gap-1.5 px-2 text-sm font-bold" style={{ color: city.branding.primaryColor }}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: city.branding.primaryColor }} />
          {city.name}
        </span>
        <nav className="flex items-center gap-0.5 pl-1" aria-label="Secciones">
          {items.map((it) => (
            <Link key={it.href} href={it.href} aria-current={it.active ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-semibold ${it.active ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-3 hover:text-ink"}`} title={it.label}>
              {it.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="pointer-events-auto hidden items-center gap-1 rounded-xl border border-line bg-paper-2/95 p-1 shadow-card backdrop-blur md:flex">
        {MOCK ? (
          <span className="rounded-md bg-amber px-2 py-1 text-[11px] font-bold text-amber-ink" title={t.common.mock}>
            demo
          </span>
        ) : null}
        <button type="button" onClick={() => setLang(lang === "es" ? "en" : "es")} className="rounded-lg px-2 py-1.5 text-xs font-bold text-ink-2 hover:bg-paper-3 hover:text-ink" aria-label={t.common.language}>
          {lang === "es" ? "EN" : "ES"}
        </button>
        <button type="button" onClick={toggleTheme} className="grid h-8 w-8 place-items-center rounded-lg text-ink-2 hover:bg-paper-3 hover:text-ink" aria-label={t.common.theme}>
          {resolved === "dark" ? <Icon.Sun /> : <Icon.Moon />}
        </button>
      </div>

      {/* Phone: wordmark + city + menu */}
      <div ref={menuRef} className="pointer-events-auto flex w-full items-center justify-between md:hidden">
        <Link href="/" className="flex h-11 items-center gap-2 rounded-xl border border-line bg-paper-2/95 px-2.5 shadow-card backdrop-blur" aria-label="opentransit">
          <Wordmark className="text-sm" />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: city.branding.primaryColor }} aria-label={city.name} />
          {MOCK ? <span className="rounded-md bg-amber px-1.5 py-0.5 text-[10px] font-bold text-amber-ink">demo</span> : null}
        </Link>
        <div className="relative">
          <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu" aria-label={t.nav.menu} className={`grid h-11 w-11 place-items-center rounded-xl border shadow-card backdrop-blur ${menu ? "border-ink bg-ink text-paper" : "border-line bg-paper-2/95 text-ink"}`}>
            {menu ? <Icon.Close /> : <Icon.List />}
          </button>
          {menu ? (
            <nav role="menu" aria-label={t.nav.menu} className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-line bg-paper-2 p-1.5 shadow-card">
              {items.map((it) => (
                <Link key={it.href} href={it.href} role="menuitem" aria-current={it.active ? "page" : undefined} className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${it.active ? "bg-ink text-paper" : "text-ink hover:bg-paper-3"}`}>
                  {it.icon}
                  {it.label}
                </Link>
              ))}
              <div className="mt-1 flex gap-1 border-t border-line pt-1">
                <button type="button" onClick={() => setLang(lang === "es" ? "en" : "es")} className="h-11 flex-1 rounded-lg text-sm font-bold text-ink-2 hover:bg-paper-3" aria-label={t.common.language}>
                  {lang === "es" ? "English" : "Español"}
                </button>
                <button type="button" onClick={toggleTheme} className="grid h-11 w-11 place-items-center rounded-lg text-ink-2 hover:bg-paper-3" aria-label={t.common.theme}>
                  {resolved === "dark" ? <Icon.Sun /> : <Icon.Moon />}
                </button>
              </div>
            </nav>
          ) : null}
        </div>
      </div>
    </header>
  );
}
