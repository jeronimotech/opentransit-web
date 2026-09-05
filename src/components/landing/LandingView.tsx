"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { CityLanding, LandingIcon, LandingResponse } from "@/lib/api/types";
import { copyFor } from "@/lib/landing-copy";
import { ctaHref, fmtStat, normalizeLanding, resolveTheme, visibleStats } from "@/lib/landing";
import { Icon } from "@/components/ui/primitives";
import { RouteDiagram } from "./RouteDiagram";

/* ── icons for highlights: the app's set plus three the landing needs ─────────── */
function HighlightIcon({ icon }: { icon: LandingIcon }) {
  const p = { width: 22, height: 22 };
  switch (icon) {
    case "route":
      return <Icon.Route {...p} />;
    case "live":
      return <Icon.Map {...p} />;
    case "board":
      return <Icon.Bus {...p} />;
    case "bike":
      return <Icon.Bike {...p} />;
    case "alert":
      return <Icon.Alert {...p} />;
    case "accessibility":
      return <Icon.Wheelchair {...p} />;
    case "favorites":
      return <Icon.Star {...p} />;
    case "map":
      return <Icon.Pin {...p} />;
    case "ticket":
      return <Icon.Fare {...p} />;
    case "offline":
      return (
        <svg viewBox="0 0 20 20" {...p} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 8a9 9 0 0 1 14 0M6 11.5a5 5 0 0 1 8 0M8.5 15a2 2 0 0 1 3 0" />
          <path d="M4 4l12 12" />
        </svg>
      );
    case "open":
      return (
        <svg viewBox="0 0 20 20" {...p} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 4H4v12h3M13 4h3v12h-3" />
          <path d="M8 10h4" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 20 20" {...p} fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="10" cy="10" r="7" />
          <path d="M10 9v5M10 6.5v.5" />
        </svg>
      );
  }
}

function Ext({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  const internal = href.startsWith("/") || href.startsWith("#");
  return internal ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function StoreBadge({ kind, href, label }: { kind: "ios" | "android" | "web"; href: string; label: string }) {
  return (
    <Ext href={href} className="lp-badge">
      <span aria-hidden className="lp-badge-icon">
        {kind === "ios" ? (
          <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
            <path d="M13.6 10.6c0-2 1.6-2.9 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6.1 1 8.1.7 1 1.5 2.1 2.5 2 1 0 1.4-.6 2.6-.6s1.6.6 2.6.6c1.1 0 1.8-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.1-3.2ZM11.6 4.7c.5-.7.9-1.6.8-2.5-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.5-.8 2.4.9.1 1.8-.4 2.3-1.1Z" />
          </svg>
        ) : kind === "android" ? (
          <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
            <path d="M3 3.5v13l7-6.5-7-6.5Zm1.6 1.4L9.3 10l-4.7 4.4V4.9ZM11.2 8.4l2-2L5.4 2l5.8 6.4Zm0 3.2L5.4 18l7.8-4.4-2-2ZM14.4 7.4 12.2 9.6l.4.4-.4.4 2.2 2.2L17 11a1.2 1.2 0 0 0 0-2l-2.6-1.6Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="10" cy="10" r="7" />
            <path d="M3 10h14M10 3c2.5 2.5 2.5 11.5 0 14M10 3c-2.5 2.5-2.5 11.5 0 14" />
          </svg>
        )}
      </span>
      <span>{label}</span>
    </Ext>
  );
}

function PhoneFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="lp-phone">
      {/* remote, city-provided images: a plain img keeps every host allowed */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" decoding="async" />
    </figure>
  );
}
function BrowserFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="lp-browser">
      <span aria-hidden className="lp-browser-bar">
        <i />
        <i />
        <i />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" decoding="async" />
    </figure>
  );
}

export type LandingViewProps = {
  data: LandingResponse;
  /** Where "open the app" goes (the city's app route). */
  appHref: string;
  preview?: boolean;
  onClosePreview?: () => void;
  /** Colours for the generated diagram; the page falls back to the theme colours. */
  diagramColors?: string[];
};

export function LandingView({ data, appHref, preview, onClosePreview, diagramColors }: LandingViewProps) {
  const l: CityLanding = normalizeLanding(data.landing);
  const t = copyFor(l.locale);
  const theme = resolveTheme(l, data.city);
  const stats = visibleStats(l, data.stats);
  const highlights = l.highlights.length ? l.highlights : (t.genericHighlights as unknown as CityLanding["highlights"]);
  const heroShot = l.screenshots.find((s) => s.kind === "mobile") ?? l.screenshots[0] ?? null;
  const title = l.hero.title?.trim() || t.heroTitle(data.city.name);
  const subtitle = l.hero.subtitle?.trim() || t.heroSubtitle;
  const primaryCta = { label: l.hero.ctaPrimary?.label?.trim() || t.openApp, href: ctaHref(l.hero.ctaPrimary, appHref) };
  const secondaryCta = l.hero.ctaSecondary?.label?.trim() ? { label: l.hero.ctaSecondary.label, href: ctaHref(l.hero.ctaSecondary, "#features") } : null;
  type Badge = { kind: "ios" | "android" | "web"; href: string; label: string };
  const apps: Badge[] = [];
  if (l.apps.ios) apps.push({ kind: "ios", href: l.apps.ios, label: t.ios });
  if (l.apps.android) apps.push({ kind: "android", href: l.apps.android, label: t.android });
  if (l.apps.web) apps.push({ kind: "web", href: l.apps.web, label: t.web });
  const colors = (diagramColors?.length ? diagramColors : [theme.primary, theme.accent]).slice(0, 6);
  const attribution = l.footer.attribution?.trim() || data.city.attribution;
  type Lnk = { label: string; href: string };
  const legal: Lnk[] = [];
  if (l.footer.privacyUrl) legal.push({ label: t.privacy, href: l.footer.privacyUrl });
  if (l.footer.termsUrl) legal.push({ label: t.terms, href: l.footer.termsUrl });
  const social: Lnk[] = [];
  if (l.contact.social.x) social.push({ label: "X", href: l.contact.social.x });
  if (l.contact.social.instagram) social.push({ label: "Instagram", href: l.contact.social.instagram });
  if (l.contact.social.github) social.push({ label: "GitHub", href: l.contact.social.github });
  const hasContact = !!(l.contact.email || l.contact.url || social.length);
  const generatedAt = data.stats?.generatedAt ? new Date(data.stats.generatedAt) : null;

  const vars = {
    "--lp-primary": theme.primary,
    "--lp-primary-ink": theme.primaryInk,
    "--lp-accent": theme.accent,
    "--lp-accent-ink": theme.accentInk,
  } as CSSProperties;

  return (
    <div className={`lp ${theme.darkHero ? "lp-dark-hero" : ""}`} style={vars} lang={l.locale}>
      <a href="#main" className="lp-skip">
        {t.skip}
      </a>
      {preview ? (
        <div role="status" className="lp-preview">
          <span>{t.previewBanner}</span>
          {onClosePreview ? (
            <button type="button" onClick={onClosePreview}>
              {t.closePreview}
            </button>
          ) : null}
        </div>
      ) : null}

      <header className="lp-header">
        <Link href={appHref} className="lp-brand" aria-label={data.city.name}>
          {theme.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.logoUrl} alt="" height={28} />
          ) : (
            <span className="lp-brand-mark" aria-hidden>
              <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="M4 14V6M10 14V6M16 14V6M4 10h12" />
              </svg>
            </span>
          )}
          <span>{data.city.name}</span>
        </Link>
        <nav className="lp-nav" aria-label={t.features}>
          <a href="#features">{t.features}</a>
          {l.screenshots.length ? <a href="#screenshots">{t.screenshots}</a> : null}
          {l.faq.length ? <a href="#faq">{t.faq}</a> : null}
        </nav>
        <Ext href={primaryCta.href} className="lp-btn lp-btn-primary lp-header-cta">
          {t.openAppShort}
        </Ext>
      </header>

      <main id="main">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="lp-hero" style={theme.heroImageUrl ? { backgroundImage: `url(${theme.heroImageUrl})` } : undefined}>
          {!theme.heroImageUrl ? <RouteDiagram seed={data.city.id} colors={colors} dark={theme.darkHero} className="lp-diagram" /> : <div className="lp-hero-scrim" aria-hidden />}
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <h1 className="lp-h1">{title}</h1>
              <p className="lp-lede">{subtitle}</p>
              <div className="lp-ctas">
                <Ext href={primaryCta.href} className="lp-btn lp-btn-primary lp-btn-lg">
                  {primaryCta.label}
                </Ext>
                {secondaryCta ? (
                  <Ext href={secondaryCta.href} className="lp-btn lp-btn-ghost lp-btn-lg">
                    {secondaryCta.label}
                  </Ext>
                ) : null}
              </div>
              {apps.length ? (
                <div className="lp-badges" aria-label={t.downloads}>
                  {apps.map((a) => (
                    <StoreBadge key={a.kind} {...a} />
                  ))}
                </div>
              ) : null}
            </div>
            {heroShot ? (
              <div className="lp-hero-shot">
                {heroShot.kind === "mobile" ? <PhoneFrame src={heroShot.url} alt={heroShot.alt} /> : <BrowserFrame src={heroShot.url} alt={heroShot.alt} />}
              </div>
            ) : null}
          </div>
        </section>

        {/* ── Live stats ───────────────────────────────────────────────── */}
        {stats.length ? (
          <section className="lp-stats" aria-label={t.statsLive}>
            <div className="lp-wrap">
              <dl className="lp-stats-row">
                {stats.map((s) => (
                  <div key={s.key} className="lp-stat">
                    <dd>{fmtStat(s.value, l.locale)}</dd>
                    <dt>{t.stats[s.key]}</dt>
                  </div>
                ))}
              </dl>
              {generatedAt ? (
                <p className="lp-stats-meta">
                  <span className="lp-live-dot" aria-hidden />
                  {t.statsLive}, {t.statsUpdated}{" "}
                  <time dateTime={generatedAt.toISOString()}>{generatedAt.toLocaleTimeString(l.locale === "es" ? "es-CO" : "en-US", { hour: "2-digit", minute: "2-digit" })}</time>
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ── Highlights ───────────────────────────────────────────────── */}
        <section id="features" className="lp-section">
          <div className="lp-wrap">
            <h2 className="lp-h2">{t.features}</h2>
            <ul className="lp-highlights">
              {highlights.map((h, i) => (
                <li key={i} className="lp-highlight">
                  <span className="lp-highlight-icon" aria-hidden>
                    <HighlightIcon icon={h.icon} />
                  </span>
                  <div>
                    <h3>{h.title}</h3>
                    {h.text ? <p>{h.text}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Screenshots ──────────────────────────────────────────────── */}
        {l.screenshots.length ? (
          <section id="screenshots" className="lp-section lp-section-tint">
            <div className="lp-wrap">
              <h2 className="lp-h2">{t.screenshots}</h2>
            </div>
            <div className="lp-rail" role="list">
              {l.screenshots.map((s, i) => (
                <div key={i} role="listitem" className={`lp-rail-item ${s.kind === "web" ? "lp-rail-item-web" : ""}`}>
                  {s.kind === "mobile" ? <PhoneFrame src={s.url} alt={s.alt} /> : <BrowserFrame src={s.url} alt={s.alt} />}
                  <figcaption>{s.alt}</figcaption>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Partners + open data ─────────────────────────────────────── */}
        {l.partners.length || (l.openData.show && l.openData.links.length) ? (
          <section className="lp-section">
            <div className="lp-wrap lp-two">
              {l.partners.length ? (
                <div>
                  <h2 className="lp-h2">{t.partners}</h2>
                  <ul className="lp-partners">
                    {l.partners.map((p, i) => (
                      <li key={i}>
                        {p.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.logoUrl} alt="" height={32} />
                        ) : null}
                        <div>
                          {p.url ? (
                            <Ext href={p.url} className="lp-partner-name">
                              {p.name}
                            </Ext>
                          ) : (
                            <span className="lp-partner-name">{p.name}</span>
                          )}
                          {p.role ? <span className="lp-partner-role">{p.role}</span> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {l.openData.show && l.openData.links.length ? (
                <div>
                  <h2 className="lp-h2">{t.openData}</h2>
                  <p className="lp-muted">{t.openDataHint}</p>
                  <ul className="lp-links">
                    {l.openData.links.map((x, i) => (
                      <li key={i}>
                        <Ext href={x.url}>
                          <span>{x.label}</span>
                          <Icon.External width={16} height={16} />
                        </Ext>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        {l.faq.length ? (
          <section id="faq" className="lp-section lp-section-tint">
            <div className="lp-wrap lp-narrow">
              <h2 className="lp-h2">{t.faq}</h2>
              <div className="lp-faq">
                {l.faq.map((f, i) => (
                  <details key={i} name="lp-faq">
                    <summary>
                      {f.q}
                      <Icon.Chevron width={18} height={18} aria-hidden />
                    </summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Contact ──────────────────────────────────────────────────── */}
        {hasContact ? (
          <section className="lp-section">
            <div className="lp-wrap lp-narrow">
              <h2 className="lp-h2">{t.contact}</h2>
              <ul className="lp-links">
                {l.contact.email ? (
                  <li>
                    <a href={`mailto:${l.contact.email}`}>
                      <span>{l.contact.email}</span>
                    </a>
                  </li>
                ) : null}
                {l.contact.url ? (
                  <li>
                    <Ext href={l.contact.url}>
                      <span>{t.write}</span>
                      <Icon.External width={16} height={16} />
                    </Ext>
                  </li>
                ) : null}
                {social.map((s) => (
                  <li key={s.label}>
                    <Ext href={s.href}>
                      <span>{s.label}</span>
                      <Icon.External width={16} height={16} />
                    </Ext>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap">
          {l.footer.legalName ? <p className="lp-footer-legal">{l.footer.legalName}</p> : null}
          <p className="lp-footer-attr">{attribution}</p>
          <p className="lp-footer-attr">{t.poweredBy}</p>
          <p className="lp-footer-links">
            {legal.map((x) => (
              <Ext key={x.label} href={x.href}>
                {x.label}
              </Ext>
            ))}
            <a href="https://github.com/jeronimotech/opentransit" target="_blank" rel="noreferrer">
              {t.madeWith}
            </a>
          </p>
        </div>
      </footer>

      <div className="lp-sticky">
        <Ext href={primaryCta.href} className="lp-btn lp-btn-primary lp-btn-lg">
          {t.openApp}
        </Ext>
      </div>
    </div>
  );
}
