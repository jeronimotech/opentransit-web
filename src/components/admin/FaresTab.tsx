"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { fmtMoney } from "@/lib/format";
import type { AdminConfigResponse, CityFares } from "@/lib/api/types";
import { fieldOverridden } from "@/lib/admin/diff";
import { farePreview } from "@/lib/admin/fare-preview";
import { RULES, validateFares, type Errors } from "@/lib/admin/validate";
import { Control, NumberInput, SaveBar, SectionCard, TextInput, Toggle, saveErrorsFrom, useSectionDraft, type SaveState } from "./form";
import { useSaveConfig } from "./useAdmin";

const DEFAULT_FARES: CityFares = { currency: "COP", base: 0, transfer: 0, transferWindowMinutes: 0, maxTransfers: 0, note: null, estimated: true };

export function FaresTab({ token, city, data }: { token: string; city: string; data: AdminConfigResponse }) {
  const { t, lang } = useI18n();
  const { draft, setDraft, dirty, overridden, reset } = useSectionDraft(data, "fares");
  const save = useSaveConfig(token, city);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const errors: Errors = { ...validateFares(draft, t.admin.errors), ...serverErrors };
  const f = draft;
  const ov = (path: string) => fieldOverridden(data.override, data.yaml, "fares", path);
  const patch = (p: Partial<CityFares>) => {
    setServerErrors({});
    setDraft({ ...(f ?? DEFAULT_FARES), ...p, estimated: true });
  };

  const onSave = async (meta: { note: string; updatedBy: string }) => {
    setState({ status: "saving" });
    try {
      const r = await save.mutateAsync({ fares: f, note: meta.note || undefined, updatedBy: meta.updatedBy || undefined });
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
      const r = await save.mutateAsync({ fares: null, note: "reset fares" });
      setState({ status: "saved", revision: r.revision });
    } catch (err) {
      setState({ status: "error", message: saveErrorsFrom(err).message });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={t.admin.fares.title} hint={t.admin.fares.hint} overridden={overridden} onReset={onReset}>
        <Toggle id="fares-enabled" checked={!!f} onChange={(v) => { setServerErrors({}); setDraft(v ? { ...(data.yaml.fares ?? DEFAULT_FARES), estimated: true } : null); }} label={t.admin.fares.enable} hint={!f ? t.admin.fares.disabled : undefined} />
        {f ? (
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
            <div className="grid grid-cols-2 gap-3">
              <Control id="fares-currency" label={t.admin.fares.currency} error={errors["fares.currency"]} overridden={ov("currency")}>
                <TextInput id="fares-currency" value={f.currency} onChange={(e) => patch({ currency: e.target.value.toUpperCase().slice(0, 3) })} maxLength={3} className="uppercase" error={errors["fares.currency"]} />
              </Control>
              <Control id="fares-base" label={t.admin.fares.base} error={errors["fares.base"]} overridden={ov("base")}>
                <NumberInput id="fares-base" value={f.base} min={0} step={50} onChange={(n) => patch({ base: n ?? NaN })} error={errors["fares.base"]} />
              </Control>
              <Control id="fares-transfer" label={t.admin.fares.transfer} error={errors["fares.transfer"]} overridden={ov("transfer")}>
                <NumberInput id="fares-transfer" value={f.transfer} min={0} step={50} onChange={(n) => patch({ transfer: n ?? NaN })} error={errors["fares.transfer"]} />
              </Control>
              <Control id="fares-window" label={t.admin.fares.window} error={errors["fares.transferWindowMinutes"]} overridden={ov("transferWindowMinutes")} hint={`${RULES.transferWindow[0]}–${RULES.transferWindow[1]}`}>
                <NumberInput id="fares-window" value={f.transferWindowMinutes} min={0} max={600} step={5} onChange={(n) => patch({ transferWindowMinutes: n ?? NaN })} error={errors["fares.transferWindowMinutes"]} />
              </Control>
              <Control id="fares-max" label={t.admin.fares.maxTransfers} error={errors["fares.maxTransfers"]} overridden={ov("maxTransfers")} hint={`${RULES.maxTransfers[0]}–${RULES.maxTransfers[1]}`}>
                <NumberInput id="fares-max" value={f.maxTransfers} min={0} max={5} step={1} onChange={(n) => patch({ maxTransfers: n ?? NaN })} error={errors["fares.maxTransfers"]} />
              </Control>
              <div className="col-span-2">
                <Control id="fares-note" label={t.admin.fares.note} error={errors["fares.note"]} overridden={ov("note")}>
                  <TextInput id="fares-note" value={f.note ?? ""} onChange={(e) => patch({ note: e.target.value || null })} placeholder={t.admin.fares.notePlaceholder} maxLength={200} error={errors["fares.note"]} />
                </Control>
              </div>
              <p className="col-span-2 text-xs text-ink-3">✓ {t.admin.fares.estimated}</p>
            </div>
            <FarePreview fares={f} valid={Object.keys(errors).length === 0} lang={lang} />
          </div>
        ) : null}
      </SectionCard>
      <SaveBar dirty={dirty} errors={errors} state={state} onSave={onSave} onDiscard={() => { reset(); setServerErrors({}); setState({ status: "idle" }); }} viewAppHref={`/${city}`} />
    </div>
  );
}

function FarePreview({ fares, valid, lang }: { fares: CityFares; valid: boolean; lang: "es" | "en" }) {
  const { t } = useI18n();
  const rows = valid ? farePreview(fares) : [];
  const money = (n: number) => fmtMoney(n, fares.currency, lang);
  return (
    <aside className="rounded-lg border border-line bg-paper p-4" aria-live="polite">
      <h3 className="text-sm font-bold">{t.admin.fares.preview}</h3>
      <p className="text-xs text-ink-3">{t.admin.fares.previewHint}</p>
      {valid ? (
        <ul className="mt-3 flex flex-col gap-1.5 text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-1.5 last:border-0">
              <span className="text-ink-2">
                {r.transfers === 0 ? t.admin.fares.trip : `${t.admin.fares.withTransfers(r.transfers)} ${r.withinWindow ? t.admin.fares.within(fares.transferWindowMinutes) : t.admin.fares.outside(fares.transferWindowMinutes)}`}
              </span>
              <strong className="tabular-nums">{money(r.amount)}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-3">—</p>
      )}
    </aside>
  );
}
