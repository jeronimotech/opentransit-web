"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/provider";
import { analyticsApi } from "@/lib/api/client";
import { Button, Icon, Spinner } from "@/components/ui/primitives";
import { AnalyticsMap, type OdKind } from "@/components/analytics/AnalyticsMap";
import { BarList, ChartCard, DataTable, Funnel, Heatmap, KpiTile, PairedBars, fmtInt } from "@/components/analytics/charts";
import type { AdminConfigResponse, AnalyticsDataset } from "@/lib/api/types";

type Preset = "d7" | "d30" | "d90" | "custom";
const iso = (d: Date) => d.toISOString().slice(0, 10);

function presetRange(p: Preset, custom: { from: string; to: string }): { from: string; to: string } {
  if (p === "custom") return custom;
  const days = p === "d7" ? 7 : p === "d30" ? 30 : 90;
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  return { from: iso(from), to: iso(to) };
}

/** The "Analítica" tab: KPI row, O-D map, hours heatmap, modes, tables, funnel, platforms, CSV export. */
export function AnalyticsTab({ token, city, data }: { token: string; city: string; data: AdminConfigResponse }) {
  const { t, lang } = useI18n();
  const A = t.admin.analytics;
  const [preset, setPreset] = useState<Preset>("d30");
  const [custom, setCustom] = useState(() => presetRange("d30", { from: "", to: "" }));
  const range = useMemo(() => presetRange(preset, custom), [preset, custom]);
  const [kind, setKind] = useState<OdKind>("origins");
  const [arcs, setArcs] = useState(true);
  const [busy, setBusy] = useState<AnalyticsDataset | null>(null);

  const q = (key: string, fn: () => Promise<unknown>) => ({ queryKey: ["admin", "analytics", city, key, range], queryFn: fn, staleTime: 60_000 });
  const summary = useQuery({ ...q("summary", () => analyticsApi.summary(token, city, range)), queryFn: () => analyticsApi.summary(token, city, range) });
  const od = useQuery({ ...q("od", () => analyticsApi.od(token, city, range)), queryFn: () => analyticsApi.od(token, city, range) });
  const hours = useQuery({ ...q("hours", () => analyticsApi.hours(token, city, range)), queryFn: () => analyticsApi.hours(token, city, range) });
  const searches = useQuery({ ...q("searches", () => analyticsApi.searches(token, city, range)), queryFn: () => analyticsApi.searches(token, city, range) });
  const providers = useQuery({ ...q("providers", () => analyticsApi.providers(token, city, range)), queryFn: () => analyticsApi.providers(token, city, range) });
  const funnel = useQuery({ ...q("funnel", () => analyticsApi.funnel(token, city, range)), queryFn: () => analyticsApi.funnel(token, city, range) });

  const exportCsv = async (dataset: AnalyticsDataset) => {
    setBusy(dataset);
    try {
      const csv = await analyticsApi.exportCsv(token, city, dataset, range);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${city}-${dataset}-${range.from}_${range.to}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally {
      setBusy(null);
    }
  };
  const exportBtn = (dataset: AnalyticsDataset) => (
    <Button size="sm" variant="ghost" onClick={() => exportCsv(dataset)} disabled={busy === dataset} title={A.exportHint}>
      {busy === dataset ? <Spinner className="h-3 w-3" /> : <Icon.External width={14} height={14} />} {A.export}
    </Button>
  );

  const s = summary.data;
  const empty = !summary.isLoading && (!s || s.kpis.sessions.value === 0);
  const providerName = (id: string) => data.effective.mobility?.onDemand?.find((p) => p.id === id)?.name ?? id;
  const kpiKeys = ["sessions", "planRequests", "itinerarySelects", "goStarts", "goCompletions", "handoffs"] as const;

  return (
    <div className="flex flex-col gap-5" data-testid="analytics-tab">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">{A.title}</h2>
          <p className="mt-1 max-w-prose text-sm text-ink-2">{A.hint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={A.range.custom}>
          {(["d7", "d30", "d90", "custom"] as Preset[]).map((p) => (
            <button key={p} type="button" aria-pressed={preset === p} onClick={() => setPreset(p)} className={`h-8 rounded-full border px-3 text-xs font-semibold ${preset === p ? "border-ink bg-ink text-paper" : "border-line bg-paper-2 text-ink-2 hover:text-ink"}`}>
              {A.range[p]}
            </button>
          ))}
          {preset === "custom" ? (
            <span className="flex items-center gap-1 text-xs">
              <label className="sr-only" htmlFor="an-from">{A.range.from}</label>
              <input id="an-from" type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="h-8 rounded-md border border-line bg-paper-2 px-2 text-xs" />
              <span className="text-ink-3">→</span>
              <label className="sr-only" htmlFor="an-to">{A.range.to}</label>
              <input id="an-to" type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="h-8 rounded-md border border-line bg-paper-2 px-2 text-xs" />
            </span>
          ) : null}
        </div>
      </header>

      {summary.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-ink-2"><Spinner /> …</div>
      ) : empty ? (
        <p className="rounded-card border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">{A.empty}</p>
      ) : s ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6" data-testid="kpi-row">
            {kpiKeys.map((k) => (
              <KpiTile key={k} label={A.kpis[k]} value={s.kpis[k].value} previous={s.kpis[k].previous} lang={lang} vsLabel={A.vsPrev} />
            ))}
          </div>

          <ChartCard
            title={A.map.title}
            hint={A.map.kNote(od.data?.kThreshold ?? s.kThreshold)}
            tableLabel={A.table}
            chartLabel={A.chart}
            actions={
              <div className="flex items-center gap-1" role="group" aria-label={A.map.title}>
                {(["origins", "destinations", "searches"] as OdKind[]).map((k) => (
                  <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`h-8 rounded-full border px-2.5 text-xs font-semibold ${kind === k ? "border-ink bg-ink text-paper" : "border-line text-ink-2 hover:text-ink"}`}>
                    {A.map[k]}
                  </button>
                ))}
                <label className="ml-2 inline-flex items-center gap-1 text-xs text-ink-2">
                  <input type="checkbox" checked={arcs} onChange={(e) => setArcs(e.target.checked)} /> {A.map.pairs}
                </label>
                {exportBtn("od")}
              </div>
            }
            table={od.data ? <DataTable head={["from", "to", "n"]} rows={od.data.pairs.map((p) => [p.fromGh7, p.toGh7, p.n])} /> : undefined}
          >
            <AnalyticsMap city={data.effective} data={od.data ?? null} kind={kind} arcs={arcs} attribution={data.effective.attribution} />
          </ChartCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title={A.hours.title} hint={A.hours.hint} tableLabel={A.table} chartLabel={A.chart} actions={exportBtn("hours")} table={hours.data ? <DataTable head={["weekday", "hour", "n"]} rows={hours.data.cells.filter((c) => c.planRequests > 0).map((c) => [A.weekdays[c.weekday], c.hour, c.planRequests])} /> : undefined}>
              {hours.data ? <Heatmap cells={hours.data.cells.map((c) => ({ weekday: c.weekday, hour: c.hour, value: c.planRequests }))} weekdays={A.weekdays} lang={lang} ariaLabel={A.hours.title} /> : <Spinner />}
            </ChartCard>
            <ChartCard title={A.modes.title} tableLabel={A.table} chartLabel={A.chart} actions={exportBtn("modes")} table={<DataTable head={["modes", A.modes.requests, A.modes.selects]} rows={s.topModes.map((m) => [m.modeSet, m.requests, m.selects])} />}>
              <PairedBars rows={s.topModes.map((m) => ({ key: m.modeSet, label: m.modeSet.replaceAll(",", " + "), a: m.requests, b: m.selects }))} lang={lang} labels={[A.modes.requests, A.modes.selects]} />
            </ChartCard>
            <ChartCard title={A.routes.title} tableLabel={A.table} chartLabel={A.chart} actions={exportBtn("routes")} table={<DataTable head={[A.routes.route, A.routes.views, A.routes.selects, A.routes.locates]} rows={s.topRoutes.map((r) => [r.shortName ?? r.routeId, r.views, r.selects, r.locates])} />}>
              <BarList lang={lang} rows={s.topRoutes.slice(0, 10).map((r) => ({ key: r.routeId, label: <span className="font-mono text-xs font-bold">{r.shortName ?? r.routeId}</span>, value: r.views, sub: `${fmtInt(r.locates, lang)} ${A.routes.locates.toLowerCase()}` }))} />
            </ChartCard>
            <ChartCard title={A.stops.title} tableLabel={A.table} chartLabel={A.chart} actions={exportBtn("stops")} table={<DataTable head={[A.stops.stop, A.stops.views, A.stops.boards, A.stops.locates]} rows={s.topStops.map((r) => [r.name ?? r.stopId, r.views, r.boards, r.locates])} />}>
              <BarList lang={lang} rows={s.topStops.slice(0, 10).map((r) => ({ key: r.stopId, label: r.name ?? r.stopId, value: r.views, sub: `${fmtInt(r.boards, lang)} ${A.stops.boards.toLowerCase()}` }))} />
            </ChartCard>
            <ChartCard title={A.searches.title} tableLabel={A.table} chartLabel={A.chart} actions={exportBtn("searches")} table={searches.data ? <DataTable head={[A.searches.what, A.searches.type, A.searches.n]} rows={searches.data.searches.map((x) => [x.label ?? x.resultId ?? "—", x.resultType, x.n])} /> : undefined}>
              {searches.data ? <BarList lang={lang} rows={searches.data.searches.slice(0, 10).map((x, i) => ({ key: `${x.resultId ?? x.label ?? i}`, label: x.label ?? x.resultId ?? "—", value: x.n, sub: x.resultType }))} /> : <Spinner />}
            </ChartCard>
            <ChartCard title={A.providers.title} tableLabel={A.table} chartLabel={A.chart} actions={exportBtn("providers")} table={providers.data ? <DataTable head={[A.providers.provider, A.providers.handoffs, A.providers.withEstimate]} rows={providers.data.providers.map((p) => [providerName(p.providerId), p.handoffs, p.hadEstimate])} /> : undefined}>
              {providers.data ? <BarList lang={lang} rows={providers.data.providers.map((p) => ({ key: p.providerId, label: providerName(p.providerId), value: p.handoffs, sub: p.hadEstimate ? `${fmtInt(p.hadEstimate, lang)} ${A.providers.withEstimate.toLowerCase()}` : undefined }))} /> : <Spinner />}
            </ChartCard>
            <ChartCard title={A.funnel.title} tableLabel={A.table} chartLabel={A.chart} actions={exportBtn("funnel")} table={funnel.data ? <DataTable head={["day", A.funnel.appOpens, A.funnel.sessions, A.funnel.planRequests, A.funnel.itinerarySelects, A.funnel.goStarts, A.funnel.goCompletions]} rows={funnel.data.days.map((d) => [d.day, d.appOpens, d.sessions, d.planRequests, d.itinerarySelects, d.goStarts, d.goCompletions])} /> : undefined}>
              {funnel.data ? (
                <Funnel lang={lang} steps={(["appOpens", "sessions", "planRequests", "itinerarySelects", "goStarts", "goCompletions"] as const).map((k) => ({ key: k, label: A.funnel[k], value: funnel.data!.totals[k] }))} />
              ) : (
                <Spinner />
              )}
            </ChartCard>
            <ChartCard title={A.platforms.title} tableLabel={A.table} chartLabel={A.chart} table={<DataTable head={["platform", A.kpis.sessions]} rows={[...s.platforms.map((p) => [p.platform, p.sessions]), ...s.versions.map((v) => [v.appVersion, v.sessions])]} />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <BarList lang={lang} rows={s.platforms.map((p) => ({ key: p.platform, label: p.platform, value: p.sessions }))} />
                <BarList lang={lang} rows={s.versions.map((v) => ({ key: v.appVersion, label: <span className="font-mono text-xs">{v.appVersion}</span>, value: v.sessions }))} />
              </div>
            </ChartCard>
          </div>
          {s.lastRollupAt ? <p className="text-xs text-ink-3">{A.lastRollup}: {new Date(s.lastRollupAt).toLocaleString(lang === "es" ? "es-CO" : "en-US")}</p> : null}
        </>
      ) : null}
    </div>
  );
}
