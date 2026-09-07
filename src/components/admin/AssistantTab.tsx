"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Badge, Button, Icon, Spinner, inputCls } from "@/components/ui/primitives";
import { assistantHealth, streamChat } from "@/lib/assistant/client";
import { DEFAULT_ASSISTANT, PROVIDERS, PROVIDER_DEFAULT_MODEL, PROVIDER_NAMES, assistantPayload, chatSessionId, isMaskedKey, keyIsNew } from "@/lib/assistant";
import { validateAssistant, type Errors } from "@/lib/admin/validate";
import { Control, NumberInput, SaveBar, SectionCard, TextInput, Toggle, saveErrorsFrom, useSectionDraft, type SaveState } from "./form";
import { useSaveConfig } from "./useAdmin";
import type { AdminConfigResponse, AssistantConfig, AssistantHealth, AssistantProvider, CityConfig } from "@/lib/api/types";

/**
 * "Asistente": provider, model, key and the spending limits.
 *
 * It edits `config.assistant`, so it saves the whole `config` section — seeded
 * from the effective value like every other tab, which is why it cannot clobber
 * what the Configuración tab owns.
 */
/** Result of the "Probar" button: one fixed question, its answer and its cost. */
type Probe =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; text: string; cost: number | null; health: AssistantHealth | null }
  | { status: "fail"; message: string };

export function AssistantTab({ token, city, data }: { token: string; city: string; data: AdminConfigResponse }) {
  const { t } = useI18n();
  const { draft, setDraft, dirty, overridden, reset } = useSectionDraft(data, "config");
  const save = useSaveConfig(token, city);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [probe, setProbe] = useState<Probe>({ status: "idle" });

  const stored = ((data.override?.config ?? data.yaml.config)?.assistant ?? null) as AssistantConfig | null;
  const a: AssistantConfig = { ...DEFAULT_ASSISTANT, ...((draft?.assistant as AssistantConfig | null) ?? {}) };
  const errors: Errors = { ...validateAssistant(a, t.admin.errors), ...serverErrors };
  const set = (patch: Partial<AssistantConfig>) => {
    setServerErrors({});
    setDraft({ ...(draft as CityConfig), assistant: { ...a, ...patch } } as CityConfig);
  };

  const onSave = async (meta: { note: string; updatedBy: string }) => {
    setState({ status: "saving" });
    try {
      const cfg = { ...(draft as CityConfig), assistant: assistantPayload(a) } as CityConfig;
      const r = await save.mutateAsync({ config: cfg, note: meta.note || undefined, updatedBy: meta.updatedBy || undefined });
      setState({ status: "saved", revision: r.revision });
    } catch (err) {
      const { errors: e, message } = saveErrorsFrom(err);
      setServerErrors(e);
      setState({ status: "error", message });
    }
  };

  /** One fixed question end-to-end, so the operator sees the key actually works. */
  const test = async () => {
    setProbe({ status: "loading" });
    let text = "";
    let cost: number | null = null;
    let failed: string | null = null;
    await new Promise<void>((resolve) => {
      streamChat(city, { sessionId: chatSessionId(), messages: [{ role: "user", content: "¿Hay desvíos hoy?" }] }, (ev) => {
        if (ev.type === "token") text += ev.text;
        else if (ev.type === "error") {
          failed = `${ev.code}: ${ev.message}`;
          resolve();
        } else if (ev.type === "done") {
          cost = ev.costUsd ?? ev.usage?.costUsd ?? null;
          resolve();
        }
      });
      setTimeout(resolve, 25_000);
    });
    if (failed) return setProbe({ status: "fail", message: failed });
    let health: AssistantHealth | null = null;
    try {
      health = await assistantHealth(city, token);
    } catch {
      /* health is a nicety, not the point of the test */
    }
    setProbe({ status: "done", text: text.trim() || t.admin.assistant.testOk, cost, health });
  };

  const k = (f: string) => `config.assistant.${f}`;
  const keyNew = keyIsNew(a, stored?.apiKey ?? null);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title={t.admin.assistant.title}
        hint={t.admin.assistant.hint}
        overridden={overridden}
        actions={
          <Button size="sm" onClick={test} disabled={!a.enabled || probe.status === "loading"}>
            {probe.status === "loading" ? <Spinner /> : <Icon.Chat width={16} height={16} />}
            {probe.status === "loading" ? t.admin.assistant.testing : t.admin.assistant.test}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Toggle id={k("enabled")} checked={a.enabled} onChange={(v) => set({ enabled: v })} label={t.admin.assistant.enabled} hint={t.admin.assistant.enabledHint} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Control id={k("provider")} label={t.admin.assistant.provider}>
              <select id={k("provider")} className={inputCls} value={a.provider} onChange={(e) => set({ provider: e.target.value as AssistantProvider })}>
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_NAMES[p]}
                  </option>
                ))}
              </select>
            </Control>
            <Control id={k("model")} label={t.admin.assistant.model} hint={t.admin.assistant.modelHint} error={errors[k("model")]}>
              <TextInput id={k("model")} value={a.model ?? ""} placeholder={PROVIDER_DEFAULT_MODEL[a.provider]} onChange={(e) => set({ model: e.target.value || null })} error={errors[k("model")]} />
            </Control>
          </div>

          <Control id={k("apiKey")} label={t.admin.assistant.apiKey} hint={t.admin.assistant.apiKeyHint} error={errors[k("apiKey")]}>
            <div className="flex items-center gap-2">
              <TextInput
                id={k("apiKey")}
                type={isMaskedKey(a.apiKey) ? "text" : "password"}
                autoComplete="off"
                value={a.apiKey ?? ""}
                placeholder="sk-…"
                onChange={(e) => set({ apiKey: e.target.value || null })}
                error={errors[k("apiKey")]}
              />
              {a.apiKey ? (
                <Button size="sm" variant="ghost" onClick={() => set({ apiKey: null })}>
                  {t.admin.assistant.apiKeyClear}
                </Button>
              ) : null}
            </div>
            {keyNew ? <p className="mt-1 text-xs font-semibold text-moss">{t.admin.assistant.apiKeyNew}</p> : null}
          </Control>

          <Control id={k("baseUrl")} label={t.admin.assistant.baseUrl} hint={t.admin.assistant.baseUrlHint} error={errors[k("baseUrl")]}>
            <TextInput id={k("baseUrl")} value={a.baseUrl ?? ""} placeholder="https://…" onChange={(e) => set({ baseUrl: e.target.value || null })} error={errors[k("baseUrl")]} />
          </Control>
        </div>
      </SectionCard>

      <SectionCard title={t.admin.assistant.limits} overridden={overridden}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Control id={k("maxRepliesPerSession")} label={t.admin.assistant.maxReplies} error={errors[k("maxRepliesPerSession")]}>
            <NumberInput id={k("maxRepliesPerSession")} min={1} max={200} value={a.maxRepliesPerSession} onChange={(n) => set({ maxRepliesPerSession: n ?? 1 })} error={errors[k("maxRepliesPerSession")]} />
          </Control>
          <Control id={k("maxToolCallsPerReply")} label={t.admin.assistant.maxTools} error={errors[k("maxToolCallsPerReply")]}>
            <NumberInput id={k("maxToolCallsPerReply")} min={1} max={20} value={a.maxToolCallsPerReply} onChange={(n) => set({ maxToolCallsPerReply: n ?? 1 })} error={errors[k("maxToolCallsPerReply")]} />
          </Control>
          <Control id={k("dailyBudgetUsd")} label={t.admin.assistant.budget} hint={t.admin.assistant.budgetHint} error={errors[k("dailyBudgetUsd")]}>
            <NumberInput id={k("dailyBudgetUsd")} min={0} step={0.5} value={a.dailyBudgetUsd} onChange={(n) => set({ dailyBudgetUsd: n ?? 0 })} error={errors[k("dailyBudgetUsd")]} />
          </Control>
          <Control id={k("rateLimitPerMinute")} label={t.admin.assistant.rate} error={errors[k("rateLimitPerMinute")]}>
            <NumberInput id={k("rateLimitPerMinute")} min={1} max={120} value={a.rateLimitPerMinute} onChange={(n) => set({ rateLimitPerMinute: n ?? 1 })} error={errors[k("rateLimitPerMinute")]} />
          </Control>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <Control id={k("systemExtra")} label={t.admin.assistant.systemExtra} hint={t.admin.assistant.systemExtraHint} error={errors[k("systemExtra")]}>
            <textarea id={k("systemExtra")} rows={3} maxLength={500} className={`${inputCls} h-auto py-2`} value={a.systemExtra ?? ""} onChange={(e) => set({ systemExtra: e.target.value || null })} />
          </Control>
          <div>
            <Toggle id={k("logConversations")} checked={a.logConversations} onChange={(v) => set({ logConversations: v })} label={t.admin.assistant.logs} />
            {a.logConversations ? (
              <p className="mt-1 rounded-lg border border-amber/60 bg-amber/15 px-3 py-2 text-xs font-semibold" role="note">
                {t.admin.assistant.logsWarn}
              </p>
            ) : null}
          </div>
        </div>
      </SectionCard>

      {probe.status === "done" || probe.status === "fail" ? (
        <SectionCard title={t.admin.assistant.test} overridden={false}>
          <p className="mb-2 text-xs text-ink-3">{t.admin.assistant.testQuestion}</p>
          {probe.status === "fail" ? (
            <p className="text-sm font-semibold text-brick" role="alert">
              {t.admin.assistant.testFail} · {probe.message}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="whitespace-pre-wrap rounded-lg border border-line bg-paper-3 px-3 py-2 text-sm">{probe.text}</p>
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
                {probe.cost != null ? <Badge tone="info">US$ {probe.cost.toFixed(4)}</Badge> : null}
                {probe.health ? (
                  <>
                    <Badge tone="neutral">
                      {t.admin.assistant.spend}: US$ {probe.health.spendTodayUsd.toFixed(2)}
                      {probe.health.dailyBudgetUsd ? ` / ${probe.health.dailyBudgetUsd.toFixed(2)}` : ""}
                    </Badge>
                    <Badge tone="neutral">
                      {t.admin.assistant.calls}: {probe.health.calls}
                    </Badge>
                  </>
                ) : null}
              </p>
            </div>
          )}
        </SectionCard>
      ) : null}

      <SaveBar dirty={dirty} errors={errors} state={state} onSave={onSave} onDiscard={reset} viewAppHref={`/${city}`} />
    </div>
  );
}
