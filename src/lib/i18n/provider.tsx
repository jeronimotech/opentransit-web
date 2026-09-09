"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dict, type Dict } from "./dict";
import type { Lang } from "../format";

type Ctx = { lang: Lang; t: Dict; setLang: (l: Lang) => void; applyCityLocale: (locale: string | null | undefined) => void };

const I18nContext = createContext<Ctx>({ lang: "es", t: dict.es, setLang: () => {}, applyCityLocale: () => {} });

const KEY = "opentransit.lang";

/**
 * The language to start in, when nobody has chosen one.
 *
 * Spanish used to be the answer everywhere, which was right while Bogotá was the only
 * city and wrong the moment Toronto existed: a Toronto visitor landed in Spanish on an
 * English city. The city's own locale comes first, the browser's preference second.
 * An explicit choice always wins over both — see [KEY].
 */
export function initialLang(cityLocale?: string | null, navigatorLangs: readonly string[] = []): Lang {
  const city = (cityLocale ?? "").slice(0, 2).toLowerCase();
  if (city === "en" || city === "es") return city;
  for (const l of navigatorLangs) {
    const code = l.slice(0, 2).toLowerCase();
    if (code === "en" || code === "es") return code;
  }
  return "es";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === "es" || v === "en") {
        setLangState(v);
        setChosen(true);
        return;
      }
    } catch {
      /* storage unavailable */
    }
    setLangState(initialLang(null, typeof navigator === "undefined" ? [] : navigator.languages ?? []));
  }, []);

  /// Apply the city's language, unless the person picked one themselves.
  const applyCityLocale = useCallback((locale: string | null | undefined) => {
    setLangState((cur) => (chosen ? cur : initialLang(locale, typeof navigator === "undefined" ? [] : navigator.languages ?? [])));
  }, [chosen]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setChosen(true);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({ lang, t: lang === "es" ? dict.es : (dict.en as unknown as Dict), setLang, applyCityLocale }),
    [lang, setLang, applyCityLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useT() {
  return useContext(I18nContext).t;
}
