"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useTheme } from "@/lib/theme";
import { MOCK } from "@/lib/api/client";
import { Wordmark } from "@/components/shell/CityHeader";
import { Button, Icon } from "@/components/ui/primitives";

export function AdminShell({ children, onLogout, crumbs }: { children: ReactNode; onLogout?: () => void; crumbs?: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { pref, setPref, resolved } = useTheme();
  const toggleTheme = () => setPref(pref === "system" ? (resolved === "dark" ? "light" : "dark") : pref === "dark" ? "light" : "dark");
  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-20 border-b border-line bg-paper-2/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/admin" className="flex items-center gap-2" aria-label="opentransit admin">
              <Wordmark className="text-sm" />
              <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-paper">admin</span>
            </Link>
            {MOCK ? <span className="rounded-md bg-amber px-1.5 py-0.5 text-[10px] font-bold text-amber-ink">demo</span> : null}
            {crumbs ? <nav aria-label="breadcrumb" className="hidden min-w-0 items-center gap-1 truncate text-sm text-ink-2 md:flex">{crumbs}</nav> : null}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setLang(lang === "es" ? "en" : "es")} className="rounded-lg px-2 py-1.5 text-xs font-bold text-ink-2 hover:bg-paper-3 hover:text-ink" aria-label={t.common.language}>
              {lang === "es" ? "EN" : "ES"}
            </button>
            <button type="button" onClick={toggleTheme} className="grid h-9 w-9 place-items-center rounded-lg text-ink-2 hover:bg-paper-3 hover:text-ink" aria-label={t.common.theme}>
              {resolved === "dark" ? <Icon.Sun /> : <Icon.Moon />}
            </button>
            {onLogout ? (
              <Button size="sm" variant="ghost" onClick={onLogout}>
                {t.admin.login.logout}
              </Button>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
