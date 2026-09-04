"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { AdminConfigResponse, CityConfig } from "@/lib/api/types";
import { fieldOverridden } from "@/lib/admin/diff";
import { RULES, validateConfig, type Errors } from "@/lib/admin/validate";
import { ConfirmInline, Control, NumberInput, SaveBar, SectionCard, TextInput, Toggle, saveErrorsFrom, useSectionDraft, type SaveState } from "./form";
import { useSaveConfig } from "./useAdmin";

const FEATURES = ["liveVehicles", "board", "pois", "followAlong", "bike", "next", "favorites", "alerts"] as const;
const DEFAULT_CONFIG: CityConfig = { vehiclePollSeconds: 15, departuresRefreshSeconds: 20, features: {}, minAppVersion: { ios: "1.0.0", android: "1.0.0" }, maintenance: { active: false, message: null } };

export function ConfigTab({ token, city, data }: { token: string; city: string; data: AdminConfigResponse }) {
  const { t } = useI18n();
  const { draft, setDraft, dirty, overridden, reset } = useSectionDraft(data, "config");
  const save = useSaveConfig(token, city);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [confirmMaint, setConfirmMaint] = useState(false);
  const c: CityConfig = draft ?? DEFAULT_CONFIG;
  const errors: Errors = { ...validateConfig(c, t.admin.errors), ...serverErrors };
  const ov = (p: string) => fieldOverridden(data.override, data.yaml, "config", p);
  const patch = (p: Partial<CityConfig>) => {
    setServerErrors({});
    setDraft({ ...c, ...p });
  };

  const onSave = async (meta: { note: string; updatedBy: string }) => {
    setState({ status: "saving" });
    try {
      const r = await save.mutateAsync({ config: c, note: meta.note || undefined, updatedBy: meta.updatedBy || undefined });
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
      const r = await save.mutateAsync({ config: null, note: "reset config" });
      setState({ status: "saved", revision: r.revision });
    } catch (err) {
      setState({ status: "error", message: saveErrorsFrom(err).message });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={t.admin.config.title} hint={t.admin.config.hint} overridden={overridden} onReset={onReset}>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-3">
            <Control id="cfg-poll" label={t.admin.config.poll} error={errors["config.vehiclePollSeconds"]} overridden={ov("vehiclePollSeconds")} hint={`${RULES.pollSeconds[0]}–${RULES.pollSeconds[1]}`}>
              <NumberInput id="cfg-poll" value={c.vehiclePollSeconds} min={5} max={120} onChange={(n) => patch({ vehiclePollSeconds: n ?? NaN })} error={errors["config.vehiclePollSeconds"]} />
            </Control>
            <Control id="cfg-refresh" label={t.admin.config.refresh} error={errors["config.departuresRefreshSeconds"]} overridden={ov("departuresRefreshSeconds")} hint={`${RULES.refreshSeconds[0]}–${RULES.refreshSeconds[1]}`}>
              <NumberInput id="cfg-refresh" value={c.departuresRefreshSeconds} min={5} max={120} onChange={(n) => patch({ departuresRefreshSeconds: n ?? NaN })} error={errors["config.departuresRefreshSeconds"]} />
            </Control>
            <Control id="cfg-ios" label={`${t.admin.config.minVersion} · ${t.admin.config.ios}`} error={errors["config.minAppVersion.ios"]} overridden={ov("minAppVersion.ios")}>
              <TextInput id="cfg-ios" value={c.minAppVersion?.ios ?? ""} onChange={(e) => patch({ minAppVersion: { ios: e.target.value, android: c.minAppVersion?.android ?? "1.0.0" } })} placeholder="1.0.0" error={errors["config.minAppVersion.ios"]} />
            </Control>
            <Control id="cfg-android" label={`${t.admin.config.minVersion} · ${t.admin.config.android}`} error={errors["config.minAppVersion.android"]} overridden={ov("minAppVersion.android")}>
              <TextInput id="cfg-android" value={c.minAppVersion?.android ?? ""} onChange={(e) => patch({ minAppVersion: { ios: c.minAppVersion?.ios ?? "1.0.0", android: e.target.value } })} placeholder="1.0.0" error={errors["config.minAppVersion.android"]} />
            </Control>
          </div>
          <fieldset>
            <legend className="mb-1 text-xs font-semibold text-ink-2">{t.admin.config.features}</legend>
            <div className="divide-y divide-line/60 rounded-lg border border-line px-2">
              {FEATURES.map((k) => (
                <Toggle key={k} id={`cfg-f-${k}`} checked={c.features?.[k] ?? true} onChange={(v) => patch({ features: { ...c.features, [k]: v } })} label={t.admin.config.feature[k]} hint={ov(`features.${k}`) ? t.admin.badge.override : undefined} />
              ))}
            </div>
          </fieldset>
        </div>
      </SectionCard>

      <SectionCard title={t.admin.config.maintenance} hint={t.admin.config.maintenanceHint} overridden={ov("maintenance.active") || ov("maintenance.message")}>
        <Toggle
          id="cfg-maint"
          checked={!!c.maintenance?.active}
          onChange={(v) => {
            if (v) setConfirmMaint(true);
            else patch({ maintenance: { active: false, message: c.maintenance?.message ?? null } });
          }}
          label={t.admin.config.maintenanceActive}
        />
        {confirmMaint ? (
          <div className="mt-2">
            <ConfirmInline
              message={t.admin.config.maintenanceConfirm}
              confirmLabel={t.admin.config.maintenanceOn}
              onConfirm={() => {
                setConfirmMaint(false);
                patch({ maintenance: { active: true, message: c.maintenance?.message ?? null } });
              }}
              onCancel={() => setConfirmMaint(false)}
            />
          </div>
        ) : null}
        <div className="mt-3">
          <Control id="cfg-maint-msg" label={t.admin.config.maintenanceMessage} error={errors["config.maintenance.message"]}>
            <TextInput id="cfg-maint-msg" value={c.maintenance?.message ?? ""} onChange={(e) => patch({ maintenance: { active: !!c.maintenance?.active, message: e.target.value || null } })} maxLength={240} error={errors["config.maintenance.message"]} />
          </Control>
        </div>
      </SectionCard>
      <SaveBar dirty={dirty} errors={errors} state={state} onSave={onSave} onDiscard={() => { reset(); setServerErrors({}); setState({ status: "idle" }); }} viewAppHref={`/${city}`} />
    </div>
  );
}
