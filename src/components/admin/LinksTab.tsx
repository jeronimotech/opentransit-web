"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { AdminConfigResponse, CityLinks } from "@/lib/api/types";
import { fieldOverridden } from "@/lib/admin/diff";
import { validateLinks, type Errors } from "@/lib/admin/validate";
import { Control, SaveBar, SectionCard, TextInput, saveErrorsFrom, useSectionDraft, type SaveState } from "./form";
import { useSaveConfig } from "./useAdmin";

const KEYS = ["pqrs", "recharge", "support", "privacy", "fares"] as const;

export function LinksTab({ token, city, data }: { token: string; city: string; data: AdminConfigResponse }) {
  const { t } = useI18n();
  const { draft, setDraft, dirty, overridden, reset } = useSectionDraft(data, "links");
  const save = useSaveConfig(token, city);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const l: CityLinks = draft ?? {};
  const errors: Errors = { ...validateLinks(l, t.admin.errors), ...serverErrors };

  const onSave = async (meta: { note: string; updatedBy: string }) => {
    setState({ status: "saving" });
    try {
      const clean: CityLinks = Object.fromEntries(KEYS.map((k) => [k, (l[k] ?? "").trim() || null]));
      const r = await save.mutateAsync({ links: clean, note: meta.note || undefined, updatedBy: meta.updatedBy || undefined });
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
      const r = await save.mutateAsync({ links: null, note: "reset links" });
      setState({ status: "saved", revision: r.revision });
    } catch (err) {
      setState({ status: "error", message: saveErrorsFrom(err).message });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={t.admin.links.title} hint={t.admin.links.hint} overridden={overridden} onReset={onReset}>
        <div className="grid gap-3 md:grid-cols-2">
          {KEYS.map((k) => (
            <Control key={k} id={`link-${k}`} label={t.admin.links[k]} error={errors[`links.${k}`]} overridden={fieldOverridden(data.override, data.yaml, "links", k)}>
              <TextInput id={`link-${k}`} type="url" inputMode="url" value={l[k] ?? ""} onChange={(e) => { setServerErrors({}); setDraft({ ...l, [k]: e.target.value }); }} placeholder="https://…" error={errors[`links.${k}`]} />
            </Control>
          ))}
        </div>
      </SectionCard>
      <SaveBar dirty={dirty} errors={errors} state={state} onSave={onSave} onDiscard={() => { reset(); setServerErrors({}); setState({ status: "idle" }); }} viewAppHref={`/${city}`} />
    </div>
  );
}
