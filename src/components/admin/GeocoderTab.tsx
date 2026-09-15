"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Badge, Button, Icon, Spinner, inputCls } from "@/components/ui/primitives";
import { api } from "@/lib/api/client";
import { isMaskedKey } from "@/lib/assistant";
import { isHttpsUrl, type Errors } from "@/lib/admin/validate";
import { effectiveSection } from "@/lib/admin/diff";
import { Control, SaveBar, SectionCard, TextInput, Toggle, saveErrorsFrom, useSectionDraft, type SaveState } from "./form";
import { useSaveConfig } from "./useAdmin";
import type { AdminConfigResponse, CityGeocoderAdmin, GeocodeResult, IdecaGeocoderAdmin } from "@/lib/api/types";

/**
 * "Direcciones": the geocoder providers. Photon (OSM) for names, and Bogotá's
 * cadastral geocoder (IDECA) for addresses and intersections — its key follows
 * the assistant's rules (masked on read, echoing the mask keeps it).
 */
const DEFAULT_IDECA: IdecaGeocoderAdmin = { enabled: false, url: "https://catalogopmb.catastrobogota.gov.co/PMBWeb/web/api", apiKey: null, aliases: {} };

/** "nombre = CÓDIGO" lines ⇄ the alias map. Returns null when a line has no "=". */
export function parseAliases(text: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const i = line.indexOf("=");
    if (i <= 0) return null;
    const name = line.slice(0, i).trim().toLowerCase();
    const code = line.slice(i + 1).trim();
    if (!name || !code) return null;
    out[name] = code;
  }
  return out;
}

export function aliasesText(aliases: Record<string, string> | null | undefined): string {
  return Object.entries(aliases ?? {})
    .map(([k, v]) => `${k} = ${v}`)
    .join("\n");
}

type Probe = { status: "idle" } | { status: "loading" } | { status: "done"; results: GeocodeResult[] } | { status: "fail" };

export function GeocoderTab({ city, data }: { city: string; data: AdminConfigResponse }) {
  const { t, lang } = useI18n();
  const { draft, setDraft, dirty, overridden, reset } = useSectionDraft(data, "geocoder");
  const save = useSaveConfig(city);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [aliasText, setAliasText] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [probe, setProbe] = useState<Probe>({ status: "idle" });

  const stored = (effectiveSection(data.override, data.yaml, "geocoder") as CityGeocoderAdmin | null)?.ideca ?? null;
  const g: CityGeocoderAdmin = { photonUrl: draft?.photonUrl ?? null, ideca: { ...DEFAULT_IDECA, ...(draft?.ideca ?? {}) } };
  const text = aliasText ?? aliasesText(g.ideca.aliases);
  const parsed = parseAliases(text);
  const errors: Errors = { ...serverErrors };
  if (g.photonUrl && !isHttpsUrl(g.photonUrl)) errors["geocoder.photonUrl"] = t.admin.errors.https;
  if (g.ideca.enabled && !isHttpsUrl(g.ideca.url)) errors["geocoder.ideca.url"] = t.admin.errors.https;
  if (parsed === null) errors["geocoder.ideca.aliases"] = t.admin.geocoder.aliasesError;

  const set = (patch: Partial<CityGeocoderAdmin>) => {
    setServerErrors({});
    setDraft({ ...g, ...patch });
  };
  const setIdeca = (patch: Partial<IdecaGeocoderAdmin>) => set({ ideca: { ...g.ideca, ...patch } });

  const onSave = async (meta: { note: string }) => {
    setState({ status: "saving" });
    try {
      const key = g.ideca.apiKey;
      const payload: CityGeocoderAdmin = { ...g, ideca: { ...g.ideca, apiKey: key === "" ? null : key, aliases: parsed ?? g.ideca.aliases } };
      const r = await save.mutateAsync({ geocoder: payload, note: meta.note || undefined });
      setAliasText(null);
      setState({ status: "saved", revision: r.revision });
    } catch (err) {
      const { errors: e, message } = saveErrorsFrom(err);
      setServerErrors(e);
      setState({ status: "error", message });
    }
  };

  const test = async () => {
    if (!q.trim()) return;
    setProbe({ status: "loading" });
    try {
      const r = await api.geocode(city, q.trim(), undefined, 6, lang);
      setProbe({ status: "done", results: r.results });
    } catch {
      setProbe({ status: "fail" });
    }
  };

  const k = (f: string) => `geocoder.${f}`;
  const keyNew = !!g.ideca.apiKey && !isMaskedKey(g.ideca.apiKey) && g.ideca.apiKey !== (stored?.apiKey ?? null);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={t.admin.geocoder.title} hint={t.admin.geocoder.hint} overridden={overridden}>
        <Control id={k("photonUrl")} label={t.admin.geocoder.photonUrl} hint={t.admin.geocoder.photonUrlHint} error={errors[k("photonUrl")]}>
          <TextInput id={k("photonUrl")} value={g.photonUrl ?? ""} placeholder="https://photon.komoot.io" onChange={(e) => set({ photonUrl: e.target.value || null })} error={errors[k("photonUrl")]} />
        </Control>
      </SectionCard>

      <SectionCard title={t.admin.geocoder.ideca} hint={t.admin.geocoder.idecaHint} overridden={overridden}>
        <div className="flex flex-col gap-4">
          <Toggle id={k("ideca.enabled")} checked={g.ideca.enabled} onChange={(v) => setIdeca({ enabled: v })} label={t.admin.geocoder.enabled} />
          <Control id={k("ideca.url")} label={t.admin.geocoder.url} error={errors[k("ideca.url")]}>
            <TextInput id={k("ideca.url")} value={g.ideca.url} onChange={(e) => setIdeca({ url: e.target.value })} error={errors[k("ideca.url")]} />
          </Control>
          <Control id={k("ideca.apiKey")} label={t.admin.geocoder.apiKey} hint={t.admin.geocoder.apiKeyHint} error={errors[k("ideca.apiKey")]}>
            <div className="flex items-center gap-2">
              <TextInput
                id={k("ideca.apiKey")}
                type={isMaskedKey(g.ideca.apiKey) ? "text" : "password"}
                autoComplete="off"
                value={g.ideca.apiKey ?? ""}
                onChange={(e) => setIdeca({ apiKey: e.target.value || null })}
                error={errors[k("ideca.apiKey")]}
              />
              {g.ideca.apiKey ? (
                <Button size="sm" variant="ghost" onClick={() => setIdeca({ apiKey: null })}>
                  {t.admin.geocoder.apiKeyClear}
                </Button>
              ) : null}
            </div>
            {keyNew ? <p className="mt-1 text-xs font-semibold text-moss">{t.admin.geocoder.apiKeyNew}</p> : null}
          </Control>
          <Control id={k("ideca.aliases")} label={t.admin.geocoder.aliases} hint={t.admin.geocoder.aliasesHint} error={errors[k("ideca.aliases")]}>
            <textarea
              id={k("ideca.aliases")}
              rows={8}
              className={`${inputCls} h-auto py-2 font-mono text-xs`}
              value={text}
              onChange={(e) => {
                setServerErrors({});
                setAliasText(e.target.value);
                const p = parseAliases(e.target.value);
                if (p) setDraft({ ...g, ideca: { ...g.ideca, aliases: p } });
              }}
            />
          </Control>
        </div>
      </SectionCard>

      <SectionCard title={t.admin.geocoder.test} hint={t.admin.geocoder.testHint} overridden={false}>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void test();
          }}
        >
          <TextInput value={q} placeholder={t.admin.geocoder.testPlaceholder} onChange={(e) => setQ(e.target.value)} />
          <Button size="sm" type="submit" disabled={!q.trim() || probe.status === "loading"}>
            {probe.status === "loading" ? <Spinner /> : <Icon.Search width={16} height={16} />}
            {probe.status === "loading" ? t.admin.geocoder.testing : t.admin.geocoder.test}
          </Button>
        </form>
        {probe.status === "fail" ? (
          <p className="mt-3 text-sm font-semibold text-brick" role="alert">
            {t.admin.geocoder.testFail}
          </p>
        ) : null}
        {probe.status === "done" ? (
          probe.results.length === 0 ? (
            <p className="mt-3 text-sm text-ink-2">{t.admin.geocoder.testEmpty}</p>
          ) : (
            <ol className="mt-3 flex flex-col gap-1">
              {probe.results.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-paper-3 px-3 py-2 text-sm">
                  <span className="font-semibold">{r.name}</span>
                  {r.label ? <span className="text-ink-2">{r.label}</span> : null}
                  <Badge tone={r.source === "ideca" ? "info" : "neutral"}>{t.admin.geocoder.source[r.source]}</Badge>
                  <span className="ml-auto font-mono text-xs text-ink-3">
                    {r.lat.toFixed(5)}, {r.lon.toFixed(5)}
                  </span>
                </li>
              ))}
            </ol>
          )
        ) : null}
      </SectionCard>

      <SaveBar dirty={dirty} errors={errors} state={state} onSave={onSave} onDiscard={() => { reset(); setAliasText(null); }} viewAppHref={`/${city}`} />
    </div>
  );
}
