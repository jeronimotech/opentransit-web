"use client";

import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Badge, Button, Icon, Spinner, inputCls } from "@/components/ui/primitives";
import type { AdminConfigResponse, AdminEditable, AdminSection } from "@/lib/api/types";
import { deepEqual, effectiveSection, sectionOverridden } from "@/lib/admin/diff";
import { ApiRequestError } from "@/lib/api/client";
import { errorsFromDetails, type Errors } from "@/lib/admin/validate";
import { getEditor, setEditor as persistEditor } from "@/lib/admin/auth";

const clone = <T,>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

/**
 * Draft state for one section: starts from the effective value (override ?? YAML) and
 * re-seeds whenever the server revision changes (after a save or reset).
 */
export function useSectionDraft<K extends AdminSection>(data: AdminConfigResponse, section: K) {
  const effective = effectiveSection(data.override, data.yaml, section);
  const [draft, setDraft] = useState<AdminEditable[K]>(() => clone(effective));
  useEffect(() => {
    setDraft(clone(effectiveSection(data.override, data.yaml, section)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.revision, section]);
  const dirty = !deepEqual(draft, effective);
  const overridden = sectionOverridden(data.override, section);
  return { draft, setDraft, dirty, overridden, effective, reset: () => setDraft(clone(effective)) };
}

export function SectionCard({ title, hint, overridden, onReset, children, actions }: { title: string; hint?: string; overridden: boolean; onReset?: () => void; children: ReactNode; actions?: ReactNode }) {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState(false);
  return (
    <section className="rounded-card border border-line bg-paper-2 shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold">
            {title}
            <Badge tone={overridden ? "info" : "neutral"}>{overridden ? t.admin.badge.override : t.admin.badge.yaml}</Badge>
          </h2>
          {hint ? <p className="mt-1 max-w-prose text-sm text-ink-2">{hint}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {onReset && overridden ? (
            confirm ? (
              <ConfirmInline message={t.admin.resetConfirm} onConfirm={() => { setConfirm(false); onReset(); }} onCancel={() => setConfirm(false)} />
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
                {t.admin.resetSection}
              </Button>
            )
          ) : null}
        </div>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function ConfirmInline({ message, onConfirm, onCancel, confirmLabel }: { message: string; onConfirm: () => void; onCancel: () => void; confirmLabel?: string }) {
  const { t } = useI18n();
  return (
    <div role="alertdialog" aria-live="assertive" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber/60 bg-amber/15 px-3 py-2 text-sm">
      <span className="max-w-prose">{message}</span>
      <Button size="sm" variant="primary" onClick={onConfirm} autoFocus>
        {confirmLabel ?? t.admin.confirm}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        {t.admin.cancel}
      </Button>
    </div>
  );
}

export function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs font-semibold text-brick">
      {error}
    </p>
  );
}

/** Label + input + override badge + error, dense enough for a settings form. */
export function Control({ id, label, hint, error, overridden, children }: { id: string; label: string; hint?: string; error?: string; overridden?: boolean; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 flex items-center gap-2 text-xs font-semibold text-ink-2">
        {label}
        {overridden ? <Badge tone="info">{t.admin.badge.override}</Badge> : null}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-ink-3">{hint}</p> : null}
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

export function TextInput({ error, className = "", ...rest }: ComponentProps<"input"> & { error?: string }) {
  return <input className={`${inputCls} ${error ? "border-brick" : ""} ${className}`} aria-invalid={!!error} aria-describedby={error ? `${rest.id}-error` : undefined} {...rest} />;
}

export function NumberInput({ value, onChange, error, className = "", ...rest }: Omit<ComponentProps<"input">, "value" | "onChange"> & { value: number | null; onChange: (n: number | null) => void; error?: string }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={`${inputCls} tabular-nums ${error ? "border-brick" : ""} ${className}`}
      value={value === null || Number.isNaN(value) ? "" : value}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      aria-invalid={!!error}
      aria-describedby={error ? `${rest.id}-error` : undefined}
      {...rest}
    />
  );
}

export function Toggle({ id, checked, onChange, label, hint, disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label htmlFor={id} className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-1 ${disabled ? "opacity-50" : ""}`}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint ? <span className="block text-xs text-ink-3">{hint}</span> : null}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-signal" : "bg-line-2"}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-paper-2 shadow transition-transform ${checked ? "translate-x-5.5 left-0.5" : "left-0.5"}`} style={{ transform: checked ? "translateX(20px)" : undefined }} />
      </button>
    </label>
  );
}

export type SaveState = { status: "idle" } | { status: "saving" } | { status: "saved"; revision: number } | { status: "error"; message: string };

/**
 * Sticky footer of every tab: note + editor name + Save. Shows the revision after a
 * save with a link to the public page so the operator can see the result at once.
 */
export function SaveBar({ dirty, errors, state, onSave, onDiscard, viewAppHref }: { dirty: boolean; errors: Errors; state: SaveState; onSave: (meta: { note: string; updatedBy: string }) => void; onDiscard: () => void; viewAppHref: string }) {
  const { t } = useI18n();
  const [note, setNote] = useState("");
  const [editor, setEditor] = useState("");
  useEffect(() => setEditor(getEditor()), []);
  const n = Object.keys(errors).length;
  return (
    <div className="sticky bottom-0 z-10 -mx-1 mt-4 rounded-card border border-line bg-paper-2/95 p-3 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-xs font-semibold text-ink-2">{t.admin.note}</span>
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.admin.notePlaceholder} maxLength={200} />
        </label>
        <label className="w-44">
          <span className="mb-1 block text-xs font-semibold text-ink-2">{t.admin.editor}</span>
          <input
            className={inputCls}
            value={editor}
            onChange={(e) => {
              setEditor(e.target.value);
              persistEditor(e.target.value);
            }}
            placeholder={t.admin.editorPlaceholder}
            maxLength={60}
          />
        </label>
        <div className="flex items-center gap-2">
          {dirty ? (
            <Button variant="ghost" onClick={onDiscard}>
              {t.admin.discard}
            </Button>
          ) : null}
          <Button variant="primary" disabled={!dirty || n > 0 || state.status === "saving"} onClick={() => { onSave({ note, updatedBy: editor }); setNote(""); }}>
            {state.status === "saving" ? <Spinner className="border-t-signal-ink" /> : <Icon.Check width={16} height={16} />}
            {state.status === "saving" ? t.admin.saving : t.admin.save}
          </Button>
        </div>
      </div>
      <div className="mt-2 min-h-5 text-xs" aria-live="polite">
        {n > 0 ? <span className="font-semibold text-brick">{t.admin.fixErrors}</span> : null}
        {n === 0 && dirty ? <span className="font-semibold text-ink-2">{t.admin.unsaved}</span> : null}
        {state.status === "saved" && !dirty ? (
          <span className="flex flex-wrap items-center gap-2 font-semibold text-moss">
            <Icon.Check width={14} height={14} /> {t.admin.saved} · {t.admin.revision} {state.revision}. {t.admin.savedHint}
            <Link href={viewAppHref} target="_blank" className="inline-flex items-center gap-1 text-signal underline-offset-2 hover:underline">
              {t.admin.viewApp} <Icon.External width={12} height={12} />
            </Link>
          </span>
        ) : null}
        {state.status === "error" ? (
          <span className="font-semibold text-brick">
            {t.admin.failed}: {state.message}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Shared save handler: local validation first, then the API; server `details` map back onto fields. */
export function saveErrorsFrom(err: unknown): { errors: Errors; message: string } {
  if (err instanceof ApiRequestError) return { errors: errorsFromDetails(err.details, err.message), message: err.message };
  return { errors: {}, message: err instanceof Error ? err.message : String(err) };
}
