"use client";

import { useI18n } from "@/lib/i18n/provider";
import { fmtMoney } from "@/lib/format";
import { estimateTaxi } from "@/lib/ondemand";
import { Button, Icon } from "@/components/ui/primitives";
import type { TariffSurcharge, TaxiTariff } from "@/lib/api/types";
import type { Errors } from "@/lib/admin/validate";
import { Control, NumberInput, TextInput } from "./form";

export const EMPTY_TARIFF: TaxiTariff = { id: "", name: "", currency: "COP", flagFall: 0, unitPrice: 0, unitMeters: 100, unitSeconds: 30, minimumFare: 0, surcharges: [], zones: [], source: { label: "", url: null }, validFrom: null, note: null };
const EMPTY_SURCHARGE: TariffSurcharge = { id: "", label: "", amount: 0, when: {} };

/**
 * "Taxi (tarifa)": taximeter parameters and surcharges for one or more tariffs, with a
 * calculator preview (5 km day / 5 km night / 15 km airport) using the same rule as the app.
 */
export function TaxiTariffEditor({ rows, onChange, errors, lang }: { rows: TaxiTariff[]; onChange: (next: TaxiTariff[]) => void; errors: Errors; lang: "es" | "en" }) {
  const { t } = useI18n();
  const a = t.admin.mobility.taxi;
  const k = (i: number, f: string) => `mobility.taxiTariffs.${i}.${f}`;
  const update = (i: number, p: Partial<TaxiTariff>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const updateSurcharge = (i: number, j: number, p: Partial<TariffSurcharge>) => update(i, { surcharges: rows[i].surcharges.map((s, x) => (x === j ? { ...s, ...p } : s)) });

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? <p className="text-sm text-ink-3">{a.empty}</p> : null}
      <ol className="flex flex-col gap-4">
        {rows.map((r, i) => (
          <li key={i} className="rounded-lg border border-line p-3" data-testid={`tariff-${i}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-bold">
                <span className="text-xs tabular-nums text-ink-3">{i + 1}</span>
                <Icon.Car width={16} height={16} />
                {r.name || r.id || "—"}
              </span>
              <Button size="iconSm" variant="ghost" aria-label={a.remove} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                <Icon.Close width={16} height={16} />
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
              <div className="grid grid-cols-2 gap-3">
                <Control id={`tar-${i}-id`} label={a.id} error={errors[k(i, "id")]}>
                  <TextInput id={`tar-${i}-id`} value={r.id} onChange={(e) => update(i, { id: e.target.value.toLowerCase() })} placeholder="taxi-2026" error={errors[k(i, "id")]} />
                </Control>
                <Control id={`tar-${i}-name`} label={a.name} error={errors[k(i, "name")]}>
                  <TextInput id={`tar-${i}-name`} value={r.name} onChange={(e) => update(i, { name: e.target.value })} error={errors[k(i, "name")]} />
                </Control>
                <Control id={`tar-${i}-currency`} label={a.currency} error={errors[k(i, "currency")]}>
                  <TextInput id={`tar-${i}-currency`} value={r.currency} onChange={(e) => update(i, { currency: e.target.value.toUpperCase().slice(0, 3) })} maxLength={3} className="uppercase" error={errors[k(i, "currency")]} />
                </Control>
                <Control id={`tar-${i}-flag`} label={a.flagFall} error={errors[k(i, "flagFall")]}>
                  <NumberInput id={`tar-${i}-flag`} value={r.flagFall} onChange={(n) => update(i, { flagFall: n ?? 0 })} min={0} error={errors[k(i, "flagFall")]} />
                </Control>
                <Control id={`tar-${i}-unit`} label={a.unitPrice} error={errors[k(i, "unitPrice")]}>
                  <NumberInput id={`tar-${i}-unit`} value={r.unitPrice} onChange={(n) => update(i, { unitPrice: n ?? 0 })} min={0} error={errors[k(i, "unitPrice")]} />
                </Control>
                <Control id={`tar-${i}-meters`} label={a.unitMeters} error={errors[k(i, "unitMeters")]}>
                  <NumberInput id={`tar-${i}-meters`} value={r.unitMeters} onChange={(n) => update(i, { unitMeters: n ?? 0 })} min={1} error={errors[k(i, "unitMeters")]} />
                </Control>
                <Control id={`tar-${i}-seconds`} label={a.unitSeconds} error={errors[k(i, "unitSeconds")]}>
                  <NumberInput id={`tar-${i}-seconds`} value={r.unitSeconds} onChange={(n) => update(i, { unitSeconds: n ?? 0 })} min={0} error={errors[k(i, "unitSeconds")]} />
                </Control>
                <Control id={`tar-${i}-min`} label={a.minimumFare} error={errors[k(i, "minimumFare")]}>
                  <NumberInput id={`tar-${i}-min`} value={r.minimumFare} onChange={(n) => update(i, { minimumFare: n ?? 0 })} min={0} error={errors[k(i, "minimumFare")]} />
                </Control>
                <Control id={`tar-${i}-src`} label={a.sourceLabel}>
                  <TextInput id={`tar-${i}-src`} value={r.source?.label ?? ""} onChange={(e) => update(i, { source: { label: e.target.value, url: r.source?.url ?? null } })} maxLength={120} />
                </Control>
                <Control id={`tar-${i}-srcurl`} label={a.sourceUrl} error={errors[k(i, "source.url")]}>
                  <TextInput id={`tar-${i}-srcurl`} type="url" value={r.source?.url ?? ""} onChange={(e) => update(i, { source: { label: r.source?.label ?? "", url: e.target.value || null } })} placeholder="https://…" error={errors[k(i, "source.url")]} />
                </Control>
                <Control id={`tar-${i}-valid`} label={a.validFrom}>
                  <TextInput id={`tar-${i}-valid`} type="date" value={r.validFrom ?? ""} onChange={(e) => update(i, { validFrom: e.target.value || null })} />
                </Control>
                <Control id={`tar-${i}-note`} label={a.note}>
                  <TextInput id={`tar-${i}-note`} value={r.note ?? ""} onChange={(e) => update(i, { note: e.target.value || null })} maxLength={160} />
                </Control>
              </div>
              <TariffPreview tariff={r} valid={!Object.keys(errors).some((e) => e.startsWith(`mobility.taxiTariffs.${i}.`))} lang={lang} />
            </div>

            {/* surcharges */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-bold text-ink-2">{a.surcharges}</h4>
                <Button size="sm" variant="ghost" onClick={() => update(i, { surcharges: [...r.surcharges, { ...EMPTY_SURCHARGE, when: {} }] })}>
                  + {a.addSurcharge}
                </Button>
              </div>
              <ol className="flex flex-col gap-2">
                {r.surcharges.map((sc, j) => {
                  const kk = (f: string) => k(i, `surcharges.${j}.${f}`);
                  const w = sc.when ?? {};
                  const night = !!(w.nightFrom || w.nightTo);
                  return (
                    <li key={j} className="grid gap-2 rounded-lg bg-paper-3 p-2 md:grid-cols-[1fr_1.4fr_0.8fr_2fr_auto]">
                      <Control id={`sc-${i}-${j}-id`} label={a.id} error={errors[kk("id")]}>
                        <TextInput id={`sc-${i}-${j}-id`} value={sc.id} onChange={(e) => updateSurcharge(i, j, { id: e.target.value.toLowerCase() })} placeholder="night" error={errors[kk("id")]} />
                      </Control>
                      <Control id={`sc-${i}-${j}-label`} label={a.surchargeLabel} error={errors[kk("label")]}>
                        <TextInput id={`sc-${i}-${j}-label`} value={sc.label} onChange={(e) => updateSurcharge(i, j, { label: e.target.value })} error={errors[kk("label")]} />
                      </Control>
                      <Control id={`sc-${i}-${j}-amount`} label={a.surchargeAmount} error={errors[kk("amount")]}>
                        <NumberInput id={`sc-${i}-${j}-amount`} value={sc.amount} onChange={(n) => updateSurcharge(i, j, { amount: n ?? 0 })} min={0} error={errors[kk("amount")]} />
                      </Control>
                      <Control id={`sc-${i}-${j}-when`} label={a.surchargeWhen} error={errors[kk("when.nightFrom")]}>
                        <div id={`sc-${i}-${j}-when`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <label className="inline-flex items-center gap-1">
                            <input type="checkbox" className="h-4 w-4 accent-[var(--signal)]" checked={night} onChange={(e) => updateSurcharge(i, j, { when: { ...w, nightFrom: e.target.checked ? (w.nightFrom ?? "19:00") : null, nightTo: e.target.checked ? (w.nightTo ?? "06:00") : null } })} />
                            {a.whenNight}
                          </label>
                          {night ? (
                            <span className="inline-flex items-center gap-1">
                              <input type="time" aria-label="from" className="h-8 rounded-md border border-line bg-paper px-1 text-xs" value={w.nightFrom ?? ""} onChange={(e) => updateSurcharge(i, j, { when: { ...w, nightFrom: e.target.value } })} />
                              –
                              <input type="time" aria-label="to" className="h-8 rounded-md border border-line bg-paper px-1 text-xs" value={w.nightTo ?? ""} onChange={(e) => updateSurcharge(i, j, { when: { ...w, nightTo: e.target.value } })} />
                            </span>
                          ) : null}
                          <label className="inline-flex items-center gap-1">
                            <input type="checkbox" className="h-4 w-4 accent-[var(--signal)]" checked={!!w.sundays} onChange={(e) => updateSurcharge(i, j, { when: { ...w, sundays: e.target.checked } })} />
                            {a.whenSundays}
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input type="checkbox" className="h-4 w-4 accent-[var(--signal)]" checked={!!w.holidays} onChange={(e) => updateSurcharge(i, j, { when: { ...w, holidays: e.target.checked } })} />
                            {a.whenHolidays}
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input type="checkbox" className="h-4 w-4 accent-[var(--signal)]" checked={!!w.optional} onChange={(e) => updateSurcharge(i, j, { when: { ...w, optional: e.target.checked } })} />
                            {a.whenOptional}
                          </label>
                          <label className="inline-flex items-center gap-1">
                            {a.whenZones}
                            <input className="h-8 w-28 rounded-md border border-line bg-paper px-1 text-xs" value={(w.zones ?? []).join(",")} onChange={(e) => updateSurcharge(i, j, { when: { ...w, zones: e.target.value.split(",").map((z) => z.trim()).filter(Boolean) } })} placeholder="airport" />
                          </label>
                        </div>
                      </Control>
                      <div className="flex items-end">
                        <Button size="iconSm" variant="ghost" aria-label={a.remove} onClick={() => update(i, { surcharges: r.surcharges.filter((_, x) => x !== j) })}>
                          <Icon.Close width={16} height={16} />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </li>
        ))}
      </ol>
      <Button size="sm" className="self-start" onClick={() => onChange([...rows, { ...EMPTY_TARIFF, surcharges: [] }])}>
        + {a.add}
      </Button>
    </div>
  );
}

function TariffPreview({ tariff, valid, lang }: { tariff: TaxiTariff; valid: boolean; lang: "es" | "en" }) {
  const { t } = useI18n();
  const a = t.admin.mobility.taxi;
  const labels = { flagFall: t.ondemand.unitFlagFall, distance: t.ondemand.unitDistance, minimum: t.ondemand.unitMinimum };
  const rows = valid
    ? [
        { label: a.previewDay, e: estimateTaxi(tariff, 5000, { hhmm: "10:00", weekday: 3 }, labels) },
        { label: a.previewNight, e: estimateTaxi(tariff, 5000, { hhmm: "21:00", weekday: 3 }, labels) },
        { label: a.previewAirport, e: estimateTaxi(tariff, 15000, { hhmm: "10:00", weekday: 3, zones: ["airport"] }, labels) },
      ]
    : [];
  return (
    <div className="rounded-lg border border-line bg-paper-3 p-3" aria-live="polite" data-testid="tariff-preview">
      <h3 className="text-sm font-bold">{a.preview}</h3>
      <p className="text-xs text-ink-3">{a.previewHint}</p>
      {rows.length ? (
        <table className="mt-2 w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-line">
                <td className="py-1.5 pr-2">
                  {r.label}
                  {r.e.surchargesApplied.length ? <span className="ml-1 text-[11px] text-ink-3">+{r.e.surchargesApplied.length}</span> : null}
                </td>
                <td className="py-1.5 text-right font-bold tabular-nums">{fmtMoney(r.e.amount, tariff.currency, lang)}</td>
                <td className="py-1.5 pl-2 text-right text-xs tabular-nums text-ink-3">
                  {fmtMoney(r.e.min, tariff.currency, lang)}–{fmtMoney(r.e.max, tariff.currency, lang)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-xs text-brick">{t.admin.fixErrors}</p>
      )}
    </div>
  );
}
