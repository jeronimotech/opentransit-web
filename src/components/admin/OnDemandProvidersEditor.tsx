"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { api } from "@/lib/api/client";
import { TEMPLATE_PLACEHOLDERS, isMaskedCredential, renderTemplate, validateTemplate } from "@/lib/ondemand";
import { Badge, Button, Icon, Spinner } from "@/components/ui/primitives";
import type { City, OnDemandPolicy, OnDemandProvider, TaxiTariff } from "@/lib/api/types";
import type { Errors } from "@/lib/admin/validate";
import { Control, NumberInput, TextInput, Toggle } from "./form";

export const EMPTY_PROVIDER: OnDemandProvider = { id: "", name: "", kind: "ridehail", color: "#111111", textColor: "#FFFFFF", logoUrl: null, estimate: { kind: "none", tariffId: null }, handoff: { kind: "url", template: null, web: null, apps: { ios: null, android: null }, scheme: null }, credentials: { clientId: null }, enabled: true, order: 1 };
export const DEFAULT_POLICY: OnDemandPolicy = { maxDirectDistanceKm: 40, firstLastMile: true, maxFeederKm: 8, showWhenTransitFaster: true };

type TestState = { status: "idle" } | { status: "loading" } | { status: "done"; url: string | null; fallback: string | null; local?: boolean } | { status: "fail" };

/**
 * "Apps de transporte y taxi": the city's on-demand providers — add / remove / reorder,
 * kind, colour, links, price source (taxi tariff / none / API), hand-off (open app, or a
 * URL template with pickup and drop-off placeholders) and a masked client id.
 * "Probar enlace" asks the API to build the hand-off for a sample trip (falls back to a
 * local render when the provider is not saved yet).
 */
export function OnDemandProvidersEditor({ rows, tariffs, policy, city, cityId, onChange, onPolicy, errors }: { rows: OnDemandProvider[]; tariffs: TaxiTariff[]; policy: OnDemandPolicy | null; city: City; cityId: string; onChange: (next: OnDemandProvider[]) => void; onPolicy: (p: OnDemandPolicy) => void; errors: Errors }) {
  const { t } = useI18n();
  const a = t.admin.mobility.providers;
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const k = (i: number, f: string) => `mobility.onDemand.${i}.${f}`;
  const update = (i: number, p: Partial<OnDemandProvider>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    // keep `order` in step with the list
    onChange(next.map((r, x) => ({ ...r, order: x + 1 })));
  };
  const pol = policy ?? DEFAULT_POLICY;

  const test = async (i: number) => {
    const p = rows[i];
    setTests((s) => ({ ...s, [p.id]: { status: "loading" } }));
    // sample trip: the city centre → 3 km north-east of it
    const trip = { pickup: { lat: city.center.lat, lon: city.center.lon, name: city.name }, dropoff: { lat: city.center.lat + 0.027, lon: city.center.lon + 0.01, name: "Destino de prueba" } };
    try {
      const r = await api.onDemandHandoff(cityId, { providerId: p.id, fromLat: trip.pickup.lat, fromLon: trip.pickup.lon, toLat: trip.dropoff.lat, toLon: trip.dropoff.lon, fromName: trip.pickup.name, toName: trip.dropoff.name, platform: "web" });
      setTests((s) => ({ ...s, [p.id]: { status: "done", url: r.url, fallback: r.fallback } }));
    } catch {
      // not saved yet (or the API is down): show what the template would produce, credentials aside
      if (p.handoff.kind === "template" && p.handoff.template) {
        setTests((s) => ({ ...s, [p.id]: { status: "done", url: renderTemplate(p.handoff.template!, { ...trip, clientId: isMaskedCredential(p.credentials?.clientId) ? "…" : (p.credentials?.clientId ?? "") }), fallback: p.handoff.web ?? null, local: true } }));
      } else setTests((s) => ({ ...s, [p.id]: { status: "fail" } }));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? <p className="text-sm text-ink-3">{a.empty}</p> : null}
      <ol className="flex flex-col gap-4">
        {rows.map((r, i) => {
          const tpl = validateTemplate(r.handoff.template);
          const test_ = tests[r.id] ?? { status: "idle" };
          const masked = isMaskedCredential(r.credentials?.clientId);
          return (
            <li key={i} className="rounded-lg border border-line p-3" style={{ borderLeftWidth: 4, borderLeftColor: r.color || "#ccc" }} data-testid={`provider-${i}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <span className="text-xs tabular-nums text-ink-3">{i + 1}</span>
                  <span className="grid h-6 w-6 place-items-center rounded-md text-[10px] font-extrabold" style={{ background: r.color, color: r.textColor ?? "#fff" }}>
                    {(r.name || r.id || "?").slice(0, 2).toUpperCase()}
                  </span>
                  {r.name || r.id || "—"}
                  <Badge tone={r.kind === "taxi" ? "warn" : "neutral"}>{r.kind === "taxi" ? a.kindTaxi : a.kindRidehail}</Badge>
                  {!r.enabled ? <Badge tone="bad">—</Badge> : null}
                </span>
                <span className="flex items-center gap-1">
                  <Button size="iconSm" variant="ghost" aria-label={a.up} disabled={i === 0} onClick={() => move(i, -1)}>
                    <Icon.Chevron width={16} height={16} style={{ transform: "rotate(-90deg)" }} />
                  </Button>
                  <Button size="iconSm" variant="ghost" aria-label={a.down} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                    <Icon.Chevron width={16} height={16} style={{ transform: "rotate(90deg)" }} />
                  </Button>
                  <Button size="iconSm" variant="ghost" aria-label={a.remove} onClick={() => onChange(rows.filter((_, j) => j !== i).map((x, y) => ({ ...x, order: y + 1 })))}>
                    <Icon.Close width={16} height={16} />
                  </Button>
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Control id={`od-${i}-id`} label={a.id} error={errors[k(i, "id")]}>
                  <TextInput id={`od-${i}-id`} value={r.id} onChange={(e) => update(i, { id: e.target.value.toLowerCase() })} placeholder="taxi" error={errors[k(i, "id")]} />
                </Control>
                <Control id={`od-${i}-name`} label={a.name} error={errors[k(i, "name")]}>
                  <TextInput id={`od-${i}-name`} value={r.name} onChange={(e) => update(i, { name: e.target.value })} error={errors[k(i, "name")]} />
                </Control>
                <Control id={`od-${i}-kind`} label={a.kind} error={errors[k(i, "kind")]}>
                  <select id={`od-${i}-kind`} className="h-10 w-full rounded-lg border border-line bg-paper-2 px-2 text-sm" value={r.kind} onChange={(e) => update(i, { kind: e.target.value as OnDemandProvider["kind"] })}>
                    <option value="taxi">{a.kindTaxi}</option>
                    <option value="ridehail">{a.kindRidehail}</option>
                  </select>
                </Control>
                <Control id={`od-${i}-color`} label={a.color} error={errors[k(i, "color")]}>
                  <span className="flex items-center gap-2">
                    <input type="color" aria-label={a.color} value={/^#[0-9a-f]{6}$/i.test(r.color) ? r.color : "#111111"} onChange={(e) => update(i, { color: e.target.value.toUpperCase() })} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-paper-2" />
                    <TextInput id={`od-${i}-color`} value={r.color} onChange={(e) => update(i, { color: e.target.value })} className="font-mono uppercase" maxLength={7} error={errors[k(i, "color")]} />
                  </span>
                </Control>
                <Control id={`od-${i}-text`} label={a.textColor} error={errors[k(i, "textColor")]}>
                  <TextInput id={`od-${i}-text`} value={r.textColor ?? ""} onChange={(e) => update(i, { textColor: e.target.value || null })} className="font-mono uppercase" maxLength={7} placeholder="#FFFFFF" error={errors[k(i, "textColor")]} />
                </Control>
                <Control id={`od-${i}-logo`} label={a.logoUrl} error={errors[k(i, "logoUrl")]}>
                  <TextInput id={`od-${i}-logo`} type="url" value={r.logoUrl ?? ""} onChange={(e) => update(i, { logoUrl: e.target.value || null })} placeholder="https://…/logo.svg" error={errors[k(i, "logoUrl")]} />
                </Control>

                <Control id={`od-${i}-est`} label={a.estimate} error={errors[k(i, "estimate.kind")]}>
                  <select id={`od-${i}-est`} className="h-10 w-full rounded-lg border border-line bg-paper-2 px-2 text-sm" value={r.estimate.kind} onChange={(e) => update(i, { estimate: { kind: e.target.value as OnDemandProvider["estimate"]["kind"], tariffId: e.target.value === "tariff" ? (r.estimate.tariffId ?? tariffs[0]?.id ?? null) : null } })}>
                    <option value="none">{a.estimateNone}</option>
                    <option value="tariff">{a.estimateTariff}</option>
                    <option value="api">{a.estimateApi}</option>
                  </select>
                </Control>
                {r.estimate.kind === "tariff" ? (
                  <Control id={`od-${i}-tariff`} label={a.tariff} error={errors[k(i, "estimate.tariffId")]}>
                    <select id={`od-${i}-tariff`} className="h-10 w-full rounded-lg border border-line bg-paper-2 px-2 text-sm" value={r.estimate.tariffId ?? ""} onChange={(e) => update(i, { estimate: { kind: "tariff", tariffId: e.target.value || null } })}>
                      <option value="">—</option>
                      {tariffs.map((tf) => (
                        <option key={tf.id} value={tf.id}>
                          {tf.name || tf.id}
                        </option>
                      ))}
                    </select>
                  </Control>
                ) : (
                  <div />
                )}
                <div className="flex items-end">
                  <Toggle id={`od-${i}-enabled`} checked={r.enabled} onChange={(v) => update(i, { enabled: v })} label={a.enabled} />
                </div>

                <Control id={`od-${i}-hk`} label={a.handoff} error={errors[k(i, "handoff.kind")]}>
                  <select id={`od-${i}-hk`} className="h-10 w-full rounded-lg border border-line bg-paper-2 px-2 text-sm" value={r.handoff.kind} onChange={(e) => update(i, { handoff: { ...r.handoff, kind: e.target.value as OnDemandProvider["handoff"]["kind"] } })}>
                    <option value="none">{a.handoffNone}</option>
                    <option value="url">{a.handoffUrl}</option>
                    <option value="template">{a.handoffTemplate}</option>
                  </select>
                </Control>
                <Control id={`od-${i}-web`} label={a.web} error={errors[k(i, "handoff.web")]}>
                  <TextInput id={`od-${i}-web`} type="url" value={r.handoff.web ?? ""} onChange={(e) => update(i, { handoff: { ...r.handoff, web: e.target.value || null } })} placeholder="https://…" error={errors[k(i, "handoff.web")]} />
                </Control>
                <Control id={`od-${i}-scheme`} label={a.scheme}>
                  <TextInput id={`od-${i}-scheme`} value={r.handoff.scheme ?? ""} onChange={(e) => update(i, { handoff: { ...r.handoff, scheme: e.target.value || null } })} placeholder="app://" />
                </Control>
                <Control id={`od-${i}-ios`} label={a.ios} error={errors[k(i, "handoff.apps.ios")]}>
                  <TextInput id={`od-${i}-ios`} type="url" value={r.handoff.apps?.ios ?? ""} onChange={(e) => update(i, { handoff: { ...r.handoff, apps: { ...(r.handoff.apps ?? {}), ios: e.target.value || null } } })} placeholder="https://apps.apple.com/…" error={errors[k(i, "handoff.apps.ios")]} />
                </Control>
                <Control id={`od-${i}-android`} label={a.android} error={errors[k(i, "handoff.apps.android")]}>
                  <TextInput id={`od-${i}-android`} type="url" value={r.handoff.apps?.android ?? ""} onChange={(e) => update(i, { handoff: { ...r.handoff, apps: { ...(r.handoff.apps ?? {}), android: e.target.value || null } } })} placeholder="https://play.google.com/…" error={errors[k(i, "handoff.apps.android")]} />
                </Control>
                <div />
                {r.handoff.kind === "template" ? (
                  <>
                    <div className="md:col-span-2">
                      <Control id={`od-${i}-tpl`} label={a.template} hint={tpl.unknown.length ? a.templateUnknown(tpl.unknown.join(", ")) : a.templateHint} error={errors[k(i, "handoff.template")]}>
                        <TextInput id={`od-${i}-tpl`} value={r.handoff.template ?? ""} onChange={(e) => update(i, { handoff: { ...r.handoff, template: e.target.value || null } })} placeholder={`https://…?client_id={clientId}&pickup={pickupJson}&drop[0]={dropoffJson}`} className="font-mono text-xs" error={errors[k(i, "handoff.template")]} />
                      </Control>
                      <p className="mt-1 flex flex-wrap gap-1">
                        {TEMPLATE_PLACEHOLDERS.map((ph) => (
                          <button key={ph} type="button" className={`rounded-md border px-1.5 py-0.5 font-mono text-[11px] ${tpl.known.includes(ph) ? "border-ink bg-ink text-paper" : "border-line text-ink-2 hover:border-ink"}`} onClick={() => update(i, { handoff: { ...r.handoff, template: `${r.handoff.template ?? ""}{${ph}}` } })}>
                            {`{${ph}}`}
                          </button>
                        ))}
                      </p>
                    </div>
                    <Control id={`od-${i}-client`} label={a.clientId} hint={masked ? a.clientIdMasked : a.clientIdHint}>
                      <TextInput id={`od-${i}-client`} type="password" autoComplete="off" value={r.credentials?.clientId ?? ""} onChange={(e) => update(i, { credentials: { clientId: e.target.value || null } })} placeholder="••••" data-masked={masked ? "1" : undefined} />
                    </Control>
                  </>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => test(i)} disabled={test_.status === "loading" || r.handoff.kind === "none"}>
                  {test_.status === "loading" ? <Spinner /> : <Icon.External width={14} height={14} />}
                  {test_.status === "loading" ? a.testing : a.test}
                </Button>
                {test_.status === "fail" ? <span role="alert" className="text-xs font-semibold text-brick">{a.testFail}</span> : null}
              </div>
              {test_.status === "done" ? (
                <div className="mt-2 rounded-lg bg-paper-3 p-2 text-xs" data-testid={`handoff-result-${i}`}>
                  <p className="font-semibold">
                    {a.testResult}
                    {test_.local ? " · local" : ""}
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px]">{test_.url ?? test_.fallback ?? "—"}</p>
                  {test_.url && test_.fallback && test_.url !== test_.fallback ? <p className="mt-1 break-all font-mono text-[11px] text-ink-3">↩ {test_.fallback}</p> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <Button size="sm" className="self-start" onClick={() => onChange([...rows, { ...EMPTY_PROVIDER, order: rows.length + 1, credentials: { clientId: null }, handoff: { ...EMPTY_PROVIDER.handoff, apps: { ios: null, android: null } } }])}>
        + {a.add}
      </Button>

      {/* policy */}
      <div className="rounded-lg border border-line p-3">
        <h4 className="mb-2 text-xs font-bold text-ink-2">{a.policy}</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <Control id="od-pol-direct" label={a.maxDirect} error={errors["mobility.onDemandPolicy.maxDirectDistanceKm"]}>
            <NumberInput id="od-pol-direct" value={pol.maxDirectDistanceKm} onChange={(n) => onPolicy({ ...pol, maxDirectDistanceKm: n ?? 0 })} min={1} error={errors["mobility.onDemandPolicy.maxDirectDistanceKm"]} />
          </Control>
          <Control id="od-pol-feeder" label={a.maxFeeder} error={errors["mobility.onDemandPolicy.maxFeederKm"]}>
            <NumberInput id="od-pol-feeder" value={pol.maxFeederKm} onChange={(n) => onPolicy({ ...pol, maxFeederKm: n ?? 0 })} min={1} error={errors["mobility.onDemandPolicy.maxFeederKm"]} />
          </Control>
          <Toggle id="od-pol-flm" checked={pol.firstLastMile} onChange={(v) => onPolicy({ ...pol, firstLastMile: v })} label={a.firstLastMile} />
          <Toggle id="od-pol-faster" checked={pol.showWhenTransitFaster} onChange={(v) => onPolicy({ ...pol, showWhenTransitFaster: v })} label={a.showWhenTransitFaster} />
        </div>
      </div>
    </div>
  );
}
