"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button, Icon } from "@/components/ui/primitives";
import type { AdminConfigResponse, CityService } from "@/lib/api/types";
import { validateServices, type Errors } from "@/lib/admin/validate";
import { Control, SaveBar, SectionCard, TextInput, saveErrorsFrom, useSectionDraft, type SaveState } from "./form";
import { useSaveConfig } from "./useAdmin";

export function ServicesTab({ token, city, data }: { token: string; city: string; data: AdminConfigResponse }) {
  const { t } = useI18n();
  const { draft, setDraft, dirty, overridden, reset } = useSectionDraft(data, "services");
  const save = useSaveConfig(token, city);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const rows: CityService[] = draft ?? [];
  const errors: Errors = { ...validateServices(rows, t.admin.errors), ...serverErrors };
  const set = (next: CityService[]) => {
    setServerErrors({});
    setDraft(next);
  };
  const update = (i: number, p: Partial<CityService>) => set(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };

  const onSave = async (meta: { note: string; updatedBy: string }) => {
    setState({ status: "saving" });
    try {
      const r = await save.mutateAsync({ services: rows, note: meta.note || undefined, updatedBy: meta.updatedBy || undefined });
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
      const r = await save.mutateAsync({ services: null, note: "reset services" });
      setState({ status: "saved", revision: r.revision });
    } catch (err) {
      setState({ status: "error", message: saveErrorsFrom(err).message });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title={t.admin.services.title}
        hint={t.admin.services.hint}
        overridden={overridden}
        onReset={onReset}
        actions={
          <Button size="sm" onClick={() => set([...rows, { id: "", label: "", icon: "link", url: "", kind: "external" }])}>
            + {t.admin.services.add}
          </Button>
        }
      >
        {rows.length === 0 ? <p className="text-sm text-ink-3">{t.admin.services.empty}</p> : null}
        <ol className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <li key={i} className="grid gap-2 rounded-lg border border-line p-3 md:grid-cols-[auto_1fr_1.2fr_1fr_2fr_auto_auto] md:items-start">
              <span className="pt-2 text-xs font-bold tabular-nums text-ink-3">{i + 1}</span>
              <Control id={`svc-${i}-id`} label={t.admin.services.id} error={errors[`services.${i}.id`]}>
                <TextInput id={`svc-${i}-id`} value={r.id} onChange={(e) => update(i, { id: e.target.value.toLowerCase() })} placeholder="recharge" error={errors[`services.${i}.id`]} />
              </Control>
              <Control id={`svc-${i}-label`} label={t.admin.services.label} error={errors[`services.${i}.label`]}>
                <TextInput id={`svc-${i}-label`} value={r.label} onChange={(e) => update(i, { label: e.target.value })} error={errors[`services.${i}.label`]} />
              </Control>
              <Control id={`svc-${i}-icon`} label={t.admin.services.icon} error={errors[`services.${i}.icon`]}>
                <TextInput id={`svc-${i}-icon`} value={r.icon} onChange={(e) => update(i, { icon: e.target.value })} placeholder="card" error={errors[`services.${i}.icon`]} />
              </Control>
              <Control id={`svc-${i}-url`} label={t.admin.services.url} error={errors[`services.${i}.url`]}>
                <TextInput id={`svc-${i}-url`} type="url" value={r.url} onChange={(e) => update(i, { url: e.target.value })} placeholder="https://…" error={errors[`services.${i}.url`]} />
              </Control>
              <Control id={`svc-${i}-kind`} label={t.admin.services.kind} error={errors[`services.${i}.kind`]}>
                <select id={`svc-${i}-kind`} className="h-10 rounded-lg border border-line bg-paper-2 px-2 text-sm" value={r.kind} onChange={(e) => update(i, { kind: e.target.value as CityService["kind"] })}>
                  <option value="external">{t.admin.services.external}</option>
                  <option value="internal">{t.admin.services.internal}</option>
                </select>
              </Control>
              <div className="flex items-end gap-1 pt-5">
                <Button size="iconSm" variant="ghost" aria-label={t.admin.services.up} disabled={i === 0} onClick={() => move(i, -1)}>
                  <Icon.Chevron width={16} height={16} style={{ transform: "rotate(-90deg)" }} />
                </Button>
                <Button size="iconSm" variant="ghost" aria-label={t.admin.services.down} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                  <Icon.Chevron width={16} height={16} style={{ transform: "rotate(90deg)" }} />
                </Button>
                <Button size="iconSm" variant="ghost" aria-label={t.admin.services.remove} onClick={() => set(rows.filter((_, j) => j !== i))}>
                  <Icon.Close width={16} height={16} />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </SectionCard>
      <SaveBar dirty={dirty} errors={errors} state={state} onSave={onSave} onDiscard={() => { reset(); setServerErrors({}); setState({ status: "idle" }); }} viewAppHref={`/${city}`} />
    </div>
  );
}
