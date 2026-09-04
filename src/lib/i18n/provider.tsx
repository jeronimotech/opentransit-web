"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dict, type Dict } from "./dict";
import type { Lang } from "../format";

type Ctx = { lang: Lang; t: Dict; setLang: (l: Lang) => void };

const I18nContext = createContext<Ctx>({ lang: "es", t: dict.es, setLang: () => {} });

const KEY = "opentransit.lang";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Lang | null;
      // Spanish is the default; English only when the person chose it.
      if (saved === "es" || saved === "en") setLangState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({ lang, t: lang === "es" ? dict.es : (dict.en as unknown as Dict), setLang }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useT() {
  return useContext(I18nContext).t;
}
