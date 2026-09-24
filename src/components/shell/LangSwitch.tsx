"use client";

import { useI18n } from "@/lib/i18n/provider";
import { isLang, LANGS } from "@/lib/format";

/**
 * The language menu. It was a two-way toggle while Spanish and English were the only
 * languages; seven languages need a list, and a native select is the one control that is
 * keyboard- and screen-reader-complete on every browser without a line of our own code.
 */
export function LangSwitch({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  return (
    <select
      value={lang}
      onChange={(e) => {
        if (isLang(e.target.value)) setLang(e.target.value);
      }}
      aria-label={t.common.language}
      className={`cursor-pointer appearance-none rounded-lg bg-transparent font-bold text-ink-2 hover:bg-paper-3 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${compact ? "px-2 py-1.5 text-xs" : "h-11 flex-1 px-3 text-sm"} ${className}`}
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {compact ? l.code.toUpperCase() : l.label}
        </option>
      ))}
    </select>
  );
}
