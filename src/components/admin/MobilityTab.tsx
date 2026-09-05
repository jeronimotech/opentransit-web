"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { fmtDateTime } from "@/lib/format";
import { api } from "@/lib/api/client";
import { Badge, Button, Icon, Spinner } from "@/components/ui/primitives";
import type { AdminConfigResponse, BikeShareNetwork, CityMobility, OnDemandPolicy, OnDemandProvider, RentalFormFactor, RentalNetworkInfo, TaxiTariff } from "@/lib/api/types";
import { providersPayload } from "@/lib/ondemand";
import { TaxiTariffEditor } from "./TaxiTariffEditor";
import { OnDemandProvidersEditor } from "./OnDemandProvidersEditor";
import { validateMobility, type Errors } from "@/lib/admin/validate";
import { Control, SaveBar, SectionCard, TextInput, saveErrorsFrom, useSectionDraft, type SaveState } from "./form";
import { useSaveConfig } from "./useAdmin";

const EMPTY: BikeShareNetwork = { id: "", name: "", network: "", gbfsUrl: "", color: "#00A859", url: null, apps: { ios: null, android: null }, pricingSummary: null, formFactors: ["bicycle"] };

/**
 * "Movilidad": the city's bike-share networks (GBFS) — N per city, add / remove /
 * reorder, each with its gbfs.json, OTP network id, colour, links and vehicle types.
 * "Probar feed" asks the public API what it currently sees for each network.
 */
export function MobilityTab({ token, city, data }: { token: string; city: string; data: AdminConfigResponse }) {
  const { t, lang } = useI18n();
  const { draft, setDraft, dirty, overridden, reset } = useSectionDraft(data, "mobility");
  const save = useSaveConfig(token, city);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [probe, setProbe] = useState<{ status: "idle" } | { status: "loading" } | { status: "done"; networks: RentalNetworkInfo[] } | { status: "fail" }>({ status: "idle" });
  const rows: BikeShareNetwork[] = draft?.bikeShare ?? [];
  const tariffs: TaxiTariff[] = draft?.taxiTariffs ?? [];
  const providers: OnDemandProvider[] = draft?.onDemand ?? [];
  const policy: OnDemandPolicy | null = draft?.onDemandPolicy ?? null;
  const errors: Errors = { ...validateMobility(draft, t.admin.errors), ...serverErrors };
  const mobility = (patch: Partial<CityMobility>): CityMobility => ({ bikeShare: rows, taxiTariffs: tariffs, onDemand: providers, onDemandPolicy: policy, ...(draft ?? {}), ...patch });
  const set = (next: BikeShareNetwork[]) => {
    setServerErrors({});
    setDraft(mobility({ bikeShare: next }));
  };
  const setTariffs = (next: TaxiTariff[]) => {
    setServerErrors({});
    setDraft(mobility({ taxiTariffs: next }));
  };
  const setProviders = (next: OnDemandProvider[]) => {
    setServerErrors({});
    setDraft(mobility({ onDemand: next }));
  };
  const setPolicy = (next: OnDemandPolicy) => {
    setServerErrors({});
    setDraft(mobility({ onDemandPolicy: next }));
  };
  /** The list replaces server-side: echo masked client ids unchanged, plain when edited, null when cleared. */
  const payload = (): CityMobility => ({ ...mobility({}), onDemand: providersPayload(providers) });
  const update = (i: number, p: Partial<BikeShareNetwork>) => set(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };
  const toggleFactor = (i: number, f: RentalFormFactor) => {
    const cur = rows[i].formFactors ?? [];
    update(i, { formFactors: cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f] });
  };

  const onSave = async (meta: { note: string; updatedBy: string }) => {
    setState({ status: "saving" });
    try {
      const r = await save.mutateAsync({ mobility: payload(), note: meta.note || undefined, updatedBy: meta.updatedBy || undefined });
      setState({ status: "saved", revision: r.revision });
    } catch (err) {
      const { errors: e, message } = saveErrorsFrom(err);
      setServerErrors(e);
      setState({ status: "error", message });
    }
  };
  const onReset = async () => {
    setState({ status: "saving" });
    try {
      const r = await save.mutateAsync({ mobility: null, note: "reset mobility" });
      setState({ status: "saved", revision: r.revision });
    } catch (err) {
      setState({ status: "error", message: saveErrorsFrom(err).message });
    }
  };
  const test = async () => {
    setProbe({ status: "loading" });
    try {
      const r = await api.rentalNetworks(city);
      setProbe({ status: "done", networks: r.networks });
    } catch {
      setProbe({ status: "fail" });
    }
  };
  const probeFor = (id: string) => (probe.status === "done" ? (probe.networks.find((n) => n.id === id) ?? null) : null);
  const k = (i: number, f: string) => `mobility.bikeShare.${i}.${f}`;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title={t.admin.mobility.title}
        hint={t.admin.mobility.hint}
        overridden={overridden}
        onReset={onReset}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={test} disabled={probe.status === "loading"}>
              {probe.status === "loading" ? <Spinner /> : <Icon.Check width={14} height={14} />}
              {probe.status === "loading" ? t.admin.mobility.testing : t.admin.mobility.test}
            </Button>
            <Button size="sm" onClick={() => set([...rows, { ...EMPTY }])}>
              + {t.admin.mobility.add}
            </Button>
          </>
        }
      >
        {probe.status === "fail" ? <p role="alert" className="mb-3 text-sm font-semibold text-brick">{t.admin.mobility.testFail}</p> : null}
        {rows.length === 0 ? <p className="text-sm text-ink-3">{t.admin.mobility.empty}</p> : null}
        <ol className="flex flex-col gap-4">
          {rows.map((r, i) => {
            const pr = probeFor(r.id);
            return (
              <li key={i} className="rounded-lg border border-line p-3" style={{ borderLeftWidth: 4, borderLeftColor: r.color || "#ccc" }}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <span className="text-xs tabular-nums text-ink-3">{i + 1}</span>
                    <Icon.Bike width={16} height={16} style={{ color: r.color }} />
                    {r.name || r.id || "—"}
                    {probe.status === "done" ? (
                      pr ? (
                        <Badge tone={pr.up ? "ok" : "bad"} title={pr.lastFetchAt ? `${t.admin.mobility.lastFetch} ${fmtDateTime(pr.lastFetchAt, data.effective.timezone, lang)}` : undefined}>
                          {pr.up ? t.admin.mobility.testOk(pr.stations, pr.vehicleTypes.length) : t.admin.mobility.testDown}
                        </Badge>
                      ) : (
                        <Badge tone="warn">{t.admin.mobility.testUnknown}</Badge>
                      )
                    ) : null}
                  </span>
                  <span className="flex items-center gap-1">
                    <Button size="iconSm" variant="ghost" aria-label={t.admin.mobility.up} disabled={i === 0} onClick={() => move(i, -1)}>
                      <Icon.Chevron width={16} height={16} style={{ transform: "rotate(-90deg)" }} />
                    </Button>
                    <Button size="iconSm" variant="ghost" aria-label={t.admin.mobility.down} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                      <Icon.Chevron width={16} height={16} style={{ transform: "rotate(90deg)" }} />
                    </Button>
                    <Button size="iconSm" variant="ghost" aria-label={t.admin.mobility.remove} onClick={() => set(rows.filter((_, j) => j !== i))}>
                      <Icon.Close width={16} height={16} />
                    </Button>
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Control id={`mob-${i}-id`} label={t.admin.mobility.id} error={errors[k(i, "id")]}>
                    <TextInput id={`mob-${i}-id`} value={r.id} onChange={(e) => update(i, { id: e.target.value.toLowerCase() })} placeholder="red-1" error={errors[k(i, "id")]} />
                  </Control>
                  <Control id={`mob-${i}-name`} label={t.admin.mobility.name} error={errors[k(i, "name")]}>
                    <TextInput id={`mob-${i}-name`} value={r.name} onChange={(e) => update(i, { name: e.target.value })} error={errors[k(i, "name")]} />
                  </Control>
                  <Control id={`mob-${i}-network`} label={t.admin.mobility.network} hint={t.admin.mobility.networkHint} error={errors[k(i, "network")]}>
                    <TextInput id={`mob-${i}-network`} value={r.network} onChange={(e) => update(i, { network: e.target.value })} error={errors[k(i, "network")]} />
                  </Control>
                  <div className="md:col-span-2">
                    <Control id={`mob-${i}-gbfs`} label={t.admin.mobility.gbfsUrl} error={errors[k(i, "gbfsUrl")]}>
                      <TextInput id={`mob-${i}-gbfs`} type="url" value={r.gbfsUrl} onChange={(e) => update(i, { gbfsUrl: e.target.value })} placeholder="https://…/gbfs.json" error={errors[k(i, "gbfsUrl")]} />
                    </Control>
                  </div>
                  <Control id={`mob-${i}-color`} label={t.admin.mobility.color} error={errors[k(i, "color")]}>
                    <span className="flex items-center gap-2">
                      <input type="color" aria-label={t.admin.mobility.color} value={/^#[0-9a-f]{6}$/i.test(r.color) ? r.color : "#00A859"} onChange={(e) => update(i, { color: e.target.value.toUpperCase() })} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-paper-2" />
                      <TextInput id={`mob-${i}-color`} value={r.color} onChange={(e) => update(i, { color: e.target.value })} className="font-mono uppercase" maxLength={7} error={errors[k(i, "color")]} />
                    </span>
                  </Control>
                  <Control id={`mob-${i}-url`} label={t.admin.mobility.url} error={errors[k(i, "url")]}>
                    <TextInput id={`mob-${i}-url`} type="url" value={r.url ?? ""} onChange={(e) => update(i, { url: e.target.value || null })} placeholder="https://…" error={errors[k(i, "url")]} />
                  </Control>
                  <Control id={`mob-${i}-ios`} label={t.admin.mobility.ios} error={errors[k(i, "apps.ios")]}>
                    <TextInput id={`mob-${i}-ios`} type="url" value={r.apps?.ios ?? ""} onChange={(e) => update(i, { apps: { ...(r.apps ?? {}), ios: e.target.value || null } })} placeholder="https://apps.apple.com/…" error={errors[k(i, "apps.ios")]} />
                  </Control>
                  <Control id={`mob-${i}-android`} label={t.admin.mobility.android} error={errors[k(i, "apps.android")]}>
                    <TextInput id={`mob-${i}-android`} type="url" value={r.apps?.android ?? ""} onChange={(e) => update(i, { apps: { ...(r.apps ?? {}), android: e.target.value || null } })} placeholder="https://play.google.com/…" error={errors[k(i, "apps.android")]} />
                  </Control>
                  <div className="md:col-span-2">
                    <Control id={`mob-${i}-pricing`} label={t.admin.mobility.pricing} hint={t.admin.mobility.pricingHint}>
                      <TextInput id={`mob-${i}-pricing`} value={r.pricingSummary ?? ""} onChange={(e) => update(i, { pricingSummary: e.target.value || null })} maxLength={120} />
                    </Control>
                  </div>
                  <Control id={`mob-${i}-factors`} label={t.admin.mobility.formFactors} error={errors[k(i, "formFactors")]}>
                    <span id={`mob-${i}-factors`} className="flex h-10 items-center gap-4 text-sm">
                      {(["bicycle", "scooter"] as RentalFormFactor[]).map((f) => (
                        <label key={f} className="inline-flex items-center gap-1.5">
                          <input type="checkbox" className="h-4 w-4 accent-[var(--signal)]" checked={(r.formFactors ?? []).includes(f)} onChange={() => toggleFactor(i, f)} />
                          {f === "bicycle" ? t.admin.mobility.bicycle : t.admin.mobility.scooter}
                        </label>
                      ))}
                    </span>
                  </Control>
                </div>
                {pr?.pricingPlans?.length ? (
                  <p className="mt-2 text-xs text-ink-3">
                    {t.rental.pricing}: {pr.pricingPlans.map((pl) => `${pl.name} ${new Intl.NumberFormat(lang === "es" ? "es-CO" : "en-US", { style: "currency", currency: pl.currency, maximumFractionDigits: 0 }).format(pl.price)}`).join(" · ")}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </SectionCard>
      {/* v1.4 · taxi tariff(s) */}
      <SectionCard title={t.admin.mobility.taxi.title} hint={t.admin.mobility.taxi.hint} overridden={overridden}>
        <TaxiTariffEditor rows={tariffs} onChange={setTariffs} errors={errors} lang={lang} />
      </SectionCard>
      {/* v1.4 · on-demand providers */}
      <SectionCard title={t.admin.mobility.providers.title} hint={t.admin.mobility.providers.hint} overridden={overridden}>
        <OnDemandProvidersEditor rows={providers} tariffs={tariffs} policy={policy} city={data.effective} cityId={city} onChange={setProviders} onPolicy={setPolicy} errors={errors} />
      </SectionCard>
      <SaveBar dirty={dirty} errors={errors} state={state} onSave={onSave} onDiscard={() => { reset(); setServerErrors({}); setState({ status: "idle" }); }} viewAppHref={`/${city}`} />
    </div>
  );
}
