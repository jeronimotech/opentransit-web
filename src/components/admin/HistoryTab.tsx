"use client";

import { useI18n } from "@/lib/i18n/provider";
import { fmtDateTime } from "@/lib/format";
import { Badge, Spinner } from "@/components/ui/primitives";
import type { AdminConfigResponse } from "@/lib/api/types";
import { effectiveChanges } from "@/lib/admin/diff";
import { useAdminHistory } from "./useAdmin";

export function HistoryTab({ token, city, data }: { token: string; city: string; data: AdminConfigResponse }) {
  const { t, lang } = useI18n();
  const h = useAdminHistory(token, city);
  const items = h.data?.items ?? [];
  const tz = data.effective.timezone;
  return (
    <section className="rounded-card border border-line bg-paper-2 shadow-card">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-base font-bold">{t.admin.history.title}</h2>
        <p className="mt-1 text-sm text-ink-2">{t.admin.history.hint}</p>
      </header>
      {h.isLoading ? (
        <div className="p-5">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <p className="p-5 text-sm text-ink-3">{t.admin.history.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr>
                <th className="px-5 py-2 font-semibold">{t.admin.history.revision}</th>
                <th className="px-3 py-2 font-semibold">{t.admin.history.when}</th>
                <th className="px-3 py-2 font-semibold">{t.admin.history.who}</th>
                <th className="px-3 py-2 font-semibold">{t.admin.history.noteCol}</th>
                <th className="px-3 py-2 font-semibold">{t.admin.history.changes}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {items.map((it, i) => {
                const prev = items[i + 1]?.data ?? null;
                const changes = effectiveChanges(prev, it.data, data.yaml);
                const shown = changes.slice(0, 6);
                return (
                  <tr key={`${it.revision}-${it.changedAt}-${i}`} className="align-top">
                    <td className="px-5 py-2.5 font-bold tabular-nums">{it.revision}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-ink-2">{fmtDateTime(it.changedAt, tz, lang)}</td>
                    <td className="px-3 py-2.5 text-ink-2">{it.changedBy ?? "—"}</td>
                    <td className="max-w-56 px-3 py-2.5 text-ink-2">{it.note ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      {(it.data === null || Object.keys(it.data).length === 0) && changes.length === 0 ? (
                        <Badge tone="warn">{t.admin.history.reset}</Badge>
                      ) : (
                        <ul className="flex flex-wrap gap-1">
                          {it.data === null || Object.keys(it.data).length === 0 ? <li><Badge tone="warn">{t.admin.history.reset}</Badge></li> : null}
                          {shown.map((c) => (
                            <li key={c.path}>
                              <Badge tone={c.kind === "removed" ? "bad" : c.kind === "added" ? "ok" : "info"} title={c.kind === "changed" ? `${String(c.from)} → ${String(c.to)}` : c.kind === "added" ? String(c.to) : String(c.from)}>
                                <span className="font-mono">{c.kind === "removed" ? "−" : c.kind === "added" ? "+" : "~"} {c.path}</span>
                              </Badge>
                            </li>
                          ))}
                          {changes.length > shown.length ? <li className="text-xs text-ink-3">{t.admin.history.more(changes.length - shown.length)}</li> : null}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
