"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { AdminConfigResponse } from "@/lib/api/types";
import { validateBranding, type Errors } from "@/lib/admin/validate";
import { RouteChip } from "@/components/ui/RouteChip";
import { Control, SaveBar, SectionCard, TextInput, saveErrorsFrom, useSectionDraft, type SaveState } from "./form";
import { useSaveConfig } from "./useAdmin";

export function BrandTab({ token, city, data }: { token: string; city: string; data: AdminConfigResponse }) {
  const { t } = useI18n();
  const { draft, setDraft, dirty, overridden, reset } = useSectionDraft(data, "branding");
  const save = useSaveConfig(token, city);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const b = draft ?? { primaryColor: "#000000" };
  const errors: Errors = { ...validateBranding(b, t.admin.errors), ...serverErrors };
  const set = (primaryColor: string) => {
    setServerErrors({});
    setDraft({ primaryColor });
  };
  const valid = !errors["branding.primaryColor"];

  const onSave = async (meta: { note: string; updatedBy: string }) => {
    setState({ status: "saving" });
    try {
      const r = await save.mutateAsync({ branding: { primaryColor: b.primaryColor.toUpperCase() }, note: meta.note || undefined, updatedBy: meta.updatedBy || undefined });
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
      const r = await save.mutateAsync({ branding: null, note: "reset branding" });
      setState({ status: "saved", revision: r.revision });
    } catch (err) {
      setState({ status: "error", message: saveErrorsFrom(err).message });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={t.admin.brand.title} hint={t.admin.brand.hint} overridden={overridden} onReset={onReset}>
        <div className="grid gap-4 md:grid-cols-2">
          <Control id="brand-primary" label={t.admin.brand.primary} error={errors["branding.primaryColor"]} overridden={overridden}>
            <div className="flex items-center gap-2">
              <input type="color" aria-label={t.admin.brand.primary} value={valid ? b.primaryColor : "#000000"} onChange={(e) => set(e.target.value.toUpperCase())} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-paper-2 p-1" />
              <TextInput id="brand-primary" value={b.primaryColor} onChange={(e) => set(e.target.value)} placeholder="#D32F2F" maxLength={7} className="font-mono uppercase" error={errors["branding.primaryColor"]} />
            </div>
          </Control>
          <div className="rounded-lg border border-line bg-paper p-4">
            <p className="text-xs font-semibold text-ink-2">{t.admin.brand.preview}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: valid ? b.primaryColor : undefined }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: valid ? b.primaryColor : "#999" }} />
                {data.effective.name}
              </span>
              <RouteChip route={{ shortName: "B13", color: valid ? b.primaryColor : "#999999", textColor: null, mode: "BUS", component: "trunk" }} />
              <button type="button" className="h-9 rounded-lg px-3 text-sm font-semibold text-white" style={{ background: valid ? b.primaryColor : "#999" }}>
                {t.hub.plan}
              </button>
            </div>
          </div>
        </div>
      </SectionCard>
      <SaveBar dirty={dirty} errors={errors} state={state} onSave={onSave} onDiscard={() => { reset(); setServerErrors({}); setState({ status: "idle" }); }} viewAppHref={`/${city}`} />
    </div>
  );
}
