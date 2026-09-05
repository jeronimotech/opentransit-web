"use client";

import { useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Badge, Button, Icon } from "@/components/ui/primitives";
import type { AdminConfigResponse, CityLanding, LandingIcon, LandingStatKey } from "@/lib/api/types";
import { LANDING_ICONS, LANDING_STAT_KEYS } from "@/lib/api/types";
import { LANDING_LIMITS, validateLanding, type Errors } from "@/lib/admin/validate";
import { normalizeLanding, writeLandingDraft } from "@/lib/landing";
import { Control, SaveBar, SectionCard, TextInput, Toggle, saveErrorsFrom, useSectionDraft, type SaveState } from "./form";
import { useSaveConfig } from "./useAdmin";

type Section = "theme" | "hero" | "apps" | "highlights" | "screenshots" | "stats" | "partners" | "openData" | "faq" | "contact" | "footer" | "seo";
const SECTIONS: Section[] = ["hero", "theme", "apps", "highlights", "screenshots", "stats", "partners", "openData", "faq", "contact", "footer", "seo"];

const textarea = "min-h-24 w-full rounded-lg border border-line bg-paper-2 px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-signal";
const nul = (v: string) => (v.trim() ? v : null);

/**
 * "Página": everything the public landing shows, one card per section, with the same
 * draft / validation / override / history mechanics as the other tabs. "Vista previa" hands
 * the unsaved draft to /{city}/landing?preview=1 through localStorage (short TTL).
 */
export function LandingTab({ token, city, data }: { token: string; city: string; data: AdminConfigResponse }) {
  const { t } = useI18n();
  const { draft, setDraft, dirty, overridden, reset } = useSectionDraft(data, "landing");
  const save = useSaveConfig(token, city);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [open, setOpen] = useState<Section>("hero");
  const l: CityLanding = normalizeLanding(draft);
  const errors: Errors = { ...validateLanding(l, t.admin.errors), ...serverErrors };
  const set = (patch: Partial<CityLanding>) => {
    setServerErrors({});
    setDraft({ ...l, ...patch });
  };
  const L = t.admin.landing;

  const onSave = async (meta: { note: string; updatedBy: string }) => {
    setState({ status: "saving" });
    try {
      const r = await save.mutateAsync({ landing: l, note: meta.note || undefined, updatedBy: meta.updatedBy || undefined });
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
      const r = await save.mutateAsync({ landing: null, note: "reset landing" });
      setState({ status: "saved", revision: r.revision });
    } catch (err) {
      setState({ status: "error", message: saveErrorsFrom(err).message });
    }
  };
  const preview = () => {
    writeLandingDraft(city, l);
    window.open(`/${encodeURIComponent(city)}/landing?preview=1`, "_blank", "noopener");
  };

  const sectionErr = (s: Section) => Object.keys(errors).some((k) => k.startsWith(`landing.${s}`));

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title={L.title}
        hint={L.hint}
        overridden={overridden}
        onReset={onReset}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={preview} title={L.previewHint}>
              <Icon.External width={14} height={14} /> {L.preview}
            </Button>
            <a href={`/${encodeURIComponent(city)}/landing`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-signal hover:bg-paper-3">
              {L.open} <Icon.External width={14} height={14} />
            </a>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <Toggle id="lp-enabled" checked={l.enabled} onChange={(v) => set({ enabled: v })} label={L.enabled} hint={L.enabledHint} />
          <Control id="lp-locale" label={L.locale} error={errors["landing.locale"]}>
            <select id="lp-locale" className="h-10 rounded-lg border border-line bg-paper-2 px-2 text-sm" value={l.locale} onChange={(e) => set({ locale: e.target.value as "es" | "en" })}>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </Control>
        </div>

        <div role="tablist" aria-label={L.title} className="mt-5 flex flex-wrap gap-1 border-b border-line">
          {SECTIONS.map((s) => (
            <button key={s} role="tab" type="button" aria-selected={open === s} onClick={() => setOpen(s)} className={`-mb-px flex h-10 items-center gap-1 border-b-2 px-3 text-sm font-semibold ${open === s ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}>
              {L.sections[s]}
              {sectionErr(s) ? <Badge tone="bad">!</Badge> : null}
            </button>
          ))}
        </div>

        <div className="mt-5" role="tabpanel">
          {open === "hero" ? (
            <div className="grid gap-4">
              <Control id="lp-title" label={L.hero.title} hint={`≤ ${LANDING_LIMITS.title}`} error={errors["landing.hero.title"]}>
                <TextInput id="lp-title" value={l.hero.title ?? ""} onChange={(e) => set({ hero: { ...l.hero, title: nul(e.target.value) } })} maxLength={LANDING_LIMITS.title + 20} error={errors["landing.hero.title"]} />
              </Control>
              <Control id="lp-subtitle" label={L.hero.subtitle} hint={`≤ ${LANDING_LIMITS.subtitle}`} error={errors["landing.hero.subtitle"]}>
                <textarea id="lp-subtitle" className={textarea} value={l.hero.subtitle ?? ""} onChange={(e) => set({ hero: { ...l.hero, subtitle: nul(e.target.value) } })} maxLength={LANDING_LIMITS.subtitle + 40} />
              </Control>
              <div className="grid gap-4 md:grid-cols-2">
                {(["ctaPrimary", "ctaSecondary"] as const).map((k) => (
                  <fieldset key={k} className="rounded-lg border border-line p-3">
                    <legend className="px-1 text-xs font-semibold text-ink-2">{L.hero[k]}</legend>
                    <div className="grid gap-3">
                      <Control id={`lp-${k}-label`} label={L.hero.label} error={errors[`landing.hero.${k}.label`]}>
                        <TextInput id={`lp-${k}-label`} value={l.hero[k]?.label ?? ""} onChange={(e) => set({ hero: { ...l.hero, [k]: e.target.value.trim() || l.hero[k]?.url ? { label: e.target.value, url: l.hero[k]?.url ?? null } : null } })} maxLength={LANDING_LIMITS.cta} error={errors[`landing.hero.${k}.label`]} />
                      </Control>
                      <Control id={`lp-${k}-url`} label={L.hero.url} hint={L.hero.urlHint} error={errors[`landing.hero.${k}.url`]}>
                        <TextInput id={`lp-${k}-url`} value={l.hero[k]?.url ?? ""} onChange={(e) => set({ hero: { ...l.hero, [k]: { label: l.hero[k]?.label ?? "", url: nul(e.target.value) } } })} placeholder="https://… | /ruta | #ancla" error={errors[`landing.hero.${k}.url`]} />
                      </Control>
                    </div>
                  </fieldset>
                ))}
              </div>
            </div>
          ) : null}

          {open === "theme" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <ColorField id="lp-primary" label={L.theme.primary} hint={L.theme.colorHint} value={l.theme.primaryColor} fallback={data.effective.branding.primaryColor} onChange={(v) => set({ theme: { ...l.theme, primaryColor: v } })} error={errors["landing.theme.primaryColor"]} />
              <ColorField id="lp-accent" label={L.theme.accent} hint={L.theme.colorHint} value={l.theme.accentColor} fallback="#0B5CD5" onChange={(v) => set({ theme: { ...l.theme, accentColor: v } })} error={errors["landing.theme.accentColor"]} />
              <Control id="lp-logo" label={L.theme.logo} error={errors["landing.theme.logoUrl"]}>
                <TextInput id="lp-logo" type="url" value={l.theme.logoUrl ?? ""} onChange={(e) => set({ theme: { ...l.theme, logoUrl: nul(e.target.value) } })} placeholder="https://…/logo.svg" error={errors["landing.theme.logoUrl"]} />
              </Control>
              <Control id="lp-heroimg" label={L.theme.heroImage} error={errors["landing.theme.heroImageUrl"]}>
                <TextInput id="lp-heroimg" type="url" value={l.theme.heroImageUrl ?? ""} onChange={(e) => set({ theme: { ...l.theme, heroImageUrl: nul(e.target.value) } })} placeholder="https://…/hero.jpg" error={errors["landing.theme.heroImageUrl"]} />
              </Control>
              <Toggle id="lp-darkhero" checked={l.theme.darkHero} onChange={(v) => set({ theme: { ...l.theme, darkHero: v } })} label={L.theme.darkHero} />
            </div>
          ) : null}

          {open === "apps" ? (
            <div className="grid gap-4">
              <p className="text-sm text-ink-2">{L.apps.hint}</p>
              {(["ios", "android", "web"] as const).map((k) => (
                <Control key={k} id={`lp-app-${k}`} label={L.apps[k]} error={errors[`landing.apps.${k}`]}>
                  <TextInput id={`lp-app-${k}`} type="url" value={l.apps[k] ?? ""} onChange={(e) => set({ apps: { ...l.apps, [k]: nul(e.target.value) } })} placeholder="https://…" error={errors[`landing.apps.${k}`]} />
                </Control>
              ))}
            </div>
          ) : null}

          {open === "highlights" ? (
            <ListEditor
              rows={l.highlights}
              max={LANDING_LIMITS.highlights}
              empty={L.highlights.empty}
              add={L.highlights.add}
              blank={{ icon: "route" as LandingIcon, title: "", text: "" }}
              onChange={(rows) => set({ highlights: rows })}
              listError={errors["landing.highlights"]}
              render={(h, i, update) => (
                <div className="grid gap-3 md:grid-cols-[140px_1fr]">
                  <Control id={`lp-h-${i}-icon`} label={L.highlights.icon} error={errors[`landing.highlights.${i}.icon`]}>
                    <select id={`lp-h-${i}-icon`} className="h-10 w-full rounded-lg border border-line bg-paper-2 px-2 text-sm" value={h.icon} onChange={(e) => update({ icon: e.target.value as LandingIcon })}>
                      {LANDING_ICONS.map((ic) => (
                        <option key={ic} value={ic}>
                          {ic}
                        </option>
                      ))}
                    </select>
                  </Control>
                  <Control id={`lp-h-${i}-title`} label={L.highlights.title} error={errors[`landing.highlights.${i}.title`]}>
                    <TextInput id={`lp-h-${i}-title`} value={h.title} onChange={(e) => update({ title: e.target.value })} maxLength={LANDING_LIMITS.highlightTitle} error={errors[`landing.highlights.${i}.title`]} />
                  </Control>
                  <div className="md:col-span-2">
                    <Control id={`lp-h-${i}-text`} label={L.highlights.text} hint={`≤ ${LANDING_LIMITS.highlightText}`} error={errors[`landing.highlights.${i}.text`]}>
                      <TextInput id={`lp-h-${i}-text`} value={h.text} onChange={(e) => update({ text: e.target.value })} maxLength={LANDING_LIMITS.highlightText + 20} error={errors[`landing.highlights.${i}.text`]} />
                    </Control>
                  </div>
                </div>
              )}
            />
          ) : null}

          {open === "screenshots" ? (
            <ListEditor
              rows={l.screenshots}
              max={LANDING_LIMITS.screenshots}
              empty={L.screenshots.empty}
              add={L.screenshots.add}
              blank={{ url: "", alt: "", kind: "mobile" as const }}
              onChange={(rows) => set({ screenshots: rows })}
              listError={errors["landing.screenshots"]}
              render={(s, i, update) => (
                <div className="grid gap-3 md:grid-cols-[2fr_1fr_120px]">
                  <Control id={`lp-s-${i}-url`} label={L.screenshots.url} error={errors[`landing.screenshots.${i}.url`]}>
                    <TextInput id={`lp-s-${i}-url`} type="url" value={s.url} onChange={(e) => update({ url: e.target.value })} placeholder="https://…/captura.png" error={errors[`landing.screenshots.${i}.url`]} />
                  </Control>
                  <Control id={`lp-s-${i}-alt`} label={L.screenshots.alt} error={errors[`landing.screenshots.${i}.alt`]}>
                    <TextInput id={`lp-s-${i}-alt`} value={s.alt} onChange={(e) => update({ alt: e.target.value })} error={errors[`landing.screenshots.${i}.alt`]} />
                  </Control>
                  <Control id={`lp-s-${i}-kind`} label={L.screenshots.kind} error={errors[`landing.screenshots.${i}.kind`]}>
                    <select id={`lp-s-${i}-kind`} className="h-10 w-full rounded-lg border border-line bg-paper-2 px-2 text-sm" value={s.kind} onChange={(e) => update({ kind: e.target.value as "mobile" | "web" })}>
                      <option value="mobile">{L.screenshots.mobile}</option>
                      <option value="web">{L.screenshots.web}</option>
                    </select>
                  </Control>
                </div>
              )}
            />
          ) : null}

          {open === "stats" ? (
            <div className="grid gap-4">
              <Toggle id="lp-stats-show" checked={l.stats.show} onChange={(v) => set({ stats: { ...l.stats, show: v } })} label={L.stats.show} />
              <fieldset>
                <legend className="mb-2 text-xs font-semibold text-ink-2">{L.stats.items}</legend>
                <div className="flex flex-wrap gap-4">
                  {LANDING_STAT_KEYS.map((k: LandingStatKey) => (
                    <label key={k} className="inline-flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--signal)]"
                        checked={l.stats.items.includes(k)}
                        onChange={(e) => set({ stats: { ...l.stats, items: e.target.checked ? [...l.stats.items, k] : l.stats.items.filter((x) => x !== k) } })}
                      />
                      {L.stats[k]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          ) : null}

          {open === "partners" ? (
            <ListEditor
              rows={l.partners}
              max={LANDING_LIMITS.partners}
              empty={L.partners.empty}
              add={L.partners.add}
              blank={{ name: "", logoUrl: null, url: null, role: null }}
              onChange={(rows) => set({ partners: rows })}
              listError={errors["landing.partners"]}
              render={(p, i, update) => (
                <div className="grid gap-3 md:grid-cols-2">
                  <Control id={`lp-p-${i}-name`} label={L.partners.name} error={errors[`landing.partners.${i}.name`]}>
                    <TextInput id={`lp-p-${i}-name`} value={p.name} onChange={(e) => update({ name: e.target.value })} error={errors[`landing.partners.${i}.name`]} />
                  </Control>
                  <Control id={`lp-p-${i}-role`} label={L.partners.role}>
                    <TextInput id={`lp-p-${i}-role`} value={p.role ?? ""} onChange={(e) => update({ role: nul(e.target.value) })} />
                  </Control>
                  <Control id={`lp-p-${i}-url`} label={L.partners.url} error={errors[`landing.partners.${i}.url`]}>
                    <TextInput id={`lp-p-${i}-url`} type="url" value={p.url ?? ""} onChange={(e) => update({ url: nul(e.target.value) })} placeholder="https://…" error={errors[`landing.partners.${i}.url`]} />
                  </Control>
                  <Control id={`lp-p-${i}-logo`} label={L.partners.logo} error={errors[`landing.partners.${i}.logoUrl`]}>
                    <TextInput id={`lp-p-${i}-logo`} type="url" value={p.logoUrl ?? ""} onChange={(e) => update({ logoUrl: nul(e.target.value) })} placeholder="https://…/logo.svg" error={errors[`landing.partners.${i}.logoUrl`]} />
                  </Control>
                </div>
              )}
            />
          ) : null}

          {open === "openData" ? (
            <div className="grid gap-4">
              <Toggle id="lp-od-show" checked={l.openData.show} onChange={(v) => set({ openData: { ...l.openData, show: v } })} label={L.openData.show} />
              <ListEditor
                rows={l.openData.links}
                max={LANDING_LIMITS.openDataLinks}
                empty={L.openData.empty}
                add={L.openData.add}
                blank={{ label: "", url: "" }}
                onChange={(rows) => set({ openData: { ...l.openData, links: rows } })}
                listError={errors["landing.openData.links"]}
                render={(x, i, update) => (
                  <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
                    <Control id={`lp-od-${i}-label`} label={L.openData.label} error={errors[`landing.openData.links.${i}.label`]}>
                      <TextInput id={`lp-od-${i}-label`} value={x.label} onChange={(e) => update({ label: e.target.value })} error={errors[`landing.openData.links.${i}.label`]} />
                    </Control>
                    <Control id={`lp-od-${i}-url`} label={L.openData.url} error={errors[`landing.openData.links.${i}.url`]}>
                      <TextInput id={`lp-od-${i}-url`} type="url" value={x.url} onChange={(e) => update({ url: e.target.value })} placeholder="https://…" error={errors[`landing.openData.links.${i}.url`]} />
                    </Control>
                  </div>
                )}
              />
            </div>
          ) : null}

          {open === "faq" ? (
            <ListEditor
              rows={l.faq}
              max={LANDING_LIMITS.faq}
              empty={L.faq.empty}
              add={L.faq.add}
              blank={{ q: "", a: "" }}
              onChange={(rows) => set({ faq: rows })}
              listError={errors["landing.faq"]}
              render={(f, i, update) => (
                <div className="grid gap-3">
                  <Control id={`lp-f-${i}-q`} label={L.faq.q} error={errors[`landing.faq.${i}.q`]}>
                    <TextInput id={`lp-f-${i}-q`} value={f.q} onChange={(e) => update({ q: e.target.value })} maxLength={LANDING_LIMITS.faqQ} error={errors[`landing.faq.${i}.q`]} />
                  </Control>
                  <Control id={`lp-f-${i}-a`} label={L.faq.a} hint={`≤ ${LANDING_LIMITS.faqA}`} error={errors[`landing.faq.${i}.a`]}>
                    <textarea id={`lp-f-${i}-a`} className={textarea} value={f.a} onChange={(e) => update({ a: e.target.value })} maxLength={LANDING_LIMITS.faqA + 50} />
                  </Control>
                </div>
              )}
            />
          ) : null}

          {open === "contact" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Control id="lp-c-email" label={L.contact.email} error={errors["landing.contact.email"]}>
                <TextInput id="lp-c-email" type="email" value={l.contact.email ?? ""} onChange={(e) => set({ contact: { ...l.contact, email: nul(e.target.value) } })} error={errors["landing.contact.email"]} />
              </Control>
              <Control id="lp-c-url" label={L.contact.url} error={errors["landing.contact.url"]}>
                <TextInput id="lp-c-url" type="url" value={l.contact.url ?? ""} onChange={(e) => set({ contact: { ...l.contact, url: nul(e.target.value) } })} placeholder="https://…" error={errors["landing.contact.url"]} />
              </Control>
              {(["x", "instagram", "github"] as const).map((k) => (
                <Control key={k} id={`lp-c-${k}`} label={L.contact[k]} error={errors[`landing.contact.social.${k}`]}>
                  <TextInput id={`lp-c-${k}`} type="url" value={l.contact.social[k] ?? ""} onChange={(e) => set({ contact: { ...l.contact, social: { ...l.contact.social, [k]: nul(e.target.value) } } })} placeholder="https://…" error={errors[`landing.contact.social.${k}`]} />
                </Control>
              ))}
            </div>
          ) : null}

          {open === "footer" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Control id="lp-ft-legal" label={L.footer.legalName}>
                <TextInput id="lp-ft-legal" value={l.footer.legalName ?? ""} onChange={(e) => set({ footer: { ...l.footer, legalName: nul(e.target.value) } })} />
              </Control>
              <Control id="lp-ft-attr" label={L.footer.attribution} hint={L.footer.attributionHint}>
                <TextInput id="lp-ft-attr" value={l.footer.attribution ?? ""} onChange={(e) => set({ footer: { ...l.footer, attribution: nul(e.target.value) } })} />
              </Control>
              <Control id="lp-ft-privacy" label={L.footer.privacy} error={errors["landing.footer.privacyUrl"]}>
                <TextInput id="lp-ft-privacy" type="url" value={l.footer.privacyUrl ?? ""} onChange={(e) => set({ footer: { ...l.footer, privacyUrl: nul(e.target.value) } })} placeholder="https://…" error={errors["landing.footer.privacyUrl"]} />
              </Control>
              <Control id="lp-ft-terms" label={L.footer.terms} error={errors["landing.footer.termsUrl"]}>
                <TextInput id="lp-ft-terms" type="url" value={l.footer.termsUrl ?? ""} onChange={(e) => set({ footer: { ...l.footer, termsUrl: nul(e.target.value) } })} placeholder="https://…" error={errors["landing.footer.termsUrl"]} />
              </Control>
            </div>
          ) : null}

          {open === "seo" ? (
            <div className="grid gap-4">
              <Control id="lp-seo-title" label={L.seo.title} hint={`≤ ${LANDING_LIMITS.seoTitle}`} error={errors["landing.seo.title"]}>
                <TextInput id="lp-seo-title" value={l.seo.title ?? ""} onChange={(e) => set({ seo: { ...l.seo, title: nul(e.target.value) } })} maxLength={LANDING_LIMITS.seoTitle + 10} error={errors["landing.seo.title"]} />
              </Control>
              <Control id="lp-seo-desc" label={L.seo.description} hint={`≤ ${LANDING_LIMITS.seoDescription}`} error={errors["landing.seo.description"]}>
                <textarea id="lp-seo-desc" className={textarea} value={l.seo.description ?? ""} onChange={(e) => set({ seo: { ...l.seo, description: nul(e.target.value) } })} maxLength={LANDING_LIMITS.seoDescription + 20} />
              </Control>
              <Control id="lp-seo-og" label={L.seo.ogImage} error={errors["landing.seo.ogImageUrl"]}>
                <TextInput id="lp-seo-og" type="url" value={l.seo.ogImageUrl ?? ""} onChange={(e) => set({ seo: { ...l.seo, ogImageUrl: nul(e.target.value) } })} placeholder="https://…/og.png" error={errors["landing.seo.ogImageUrl"]} />
              </Control>
            </div>
          ) : null}
        </div>
      </SectionCard>
      <SaveBar dirty={dirty} errors={errors} state={state} onSave={onSave} onDiscard={() => { reset(); setServerErrors({}); setState({ status: "idle" }); }} viewAppHref={`/${city}/landing`} />
    </div>
  );
}

function ColorField({ id, label, hint, value, fallback, onChange, error }: { id: string; label: string; hint: string; value: string | null; fallback: string; onChange: (v: string | null) => void; error?: string }) {
  const valid = !!value && /^#[0-9a-f]{6}$/i.test(value);
  return (
    <Control id={id} label={label} hint={hint} error={error}>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={label} value={valid ? value! : fallback} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-paper-2 p-1" />
        <TextInput id={id} value={value ?? ""} onChange={(e) => onChange(nul(e.target.value))} placeholder={fallback} maxLength={7} className="font-mono uppercase" error={error} />
      </div>
    </Control>
  );
}

/** Generic ordered list editor: add / remove / reorder with a cap. */
function ListEditor<T>({ rows, max, empty, add, blank, onChange, render, listError }: { rows: T[]; max: number; empty: string; add: string; blank: T; onChange: (rows: T[]) => void; render: (row: T, i: number, update: (p: Partial<T>) => void) => ReactNode; listError?: string }) {
  const { t } = useI18n();
  const L = t.admin.landing;
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs text-ink-3">
          {rows.length} / {max}
        </span>
        <Button size="sm" onClick={() => onChange([...rows, { ...blank }])} disabled={rows.length >= max}>
          + {add}
        </Button>
      </div>
      {listError ? <p role="alert" className="mb-2 text-xs font-semibold text-brick">{listError}</p> : null}
      {rows.length === 0 ? <p className="text-sm text-ink-3">{empty}</p> : null}
      <ol className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <li key={i} className="grid gap-2 rounded-lg border border-line p-3 md:grid-cols-[auto_1fr_auto]">
            <span className="pt-2 text-xs font-bold tabular-nums text-ink-3">{i + 1}</span>
            <div>{render(r, i, (p) => onChange(rows.map((x, j) => (j === i ? { ...x, ...p } : x))))}</div>
            <div className="flex items-start gap-1">
              <Button size="iconSm" variant="ghost" aria-label={L.up} disabled={i === 0} onClick={() => move(i, -1)}>
                <Icon.Chevron width={16} height={16} style={{ transform: "rotate(-90deg)" }} />
              </Button>
              <Button size="iconSm" variant="ghost" aria-label={L.down} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                <Icon.Chevron width={16} height={16} style={{ transform: "rotate(90deg)" }} />
              </Button>
              <Button size="iconSm" variant="ghost" aria-label={L.remove} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                <Icon.Close width={16} height={16} />
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
