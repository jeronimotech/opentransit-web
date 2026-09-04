"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none select-none";
const variants: Record<Variant, string> = {
  primary: "bg-signal text-signal-ink hover:brightness-110 active:brightness-95",
  secondary: "bg-paper-3 text-ink hover:bg-line active:bg-line-2",
  ghost: "text-ink-2 hover:bg-paper-3 hover:text-ink",
  danger: "bg-brick-soft text-brick hover:brightness-95",
};
const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
  icon: "h-10 w-10",
  iconSm: "h-8 w-8",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest} />;
}

export function LinkButton({
  variant = "secondary",
  size = "md",
  className = "",
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest} />;
}

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: "neutral" | "live" | "ok" | "warn" | "bad" | "info";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "bg-paper-3 text-ink-2",
    live: "bg-amber text-amber-ink",
    ok: "bg-moss-soft text-moss",
    warn: "bg-amber/25 text-ink",
    bad: "bg-brick-soft text-brick",
    info: "bg-signal-soft text-signal",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-tight ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-line-2 border-t-signal ${className}`}
    />
  );
}

export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-card border border-dashed border-line-2 p-5">
      {icon ? <div className="text-ink-3">{icon}</div> : null}
      <p className="text-base font-bold text-ink">{title}</p>
      {hint ? <p className="max-w-prose text-sm text-ink-2">{hint}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-line bg-paper-2 shadow-card ${className}`}>
      {children}
    </section>
  );
}

export function Field({
  label,
  children,
  htmlFor,
  hint,
}: {
  label: string;
  children: ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-2">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-3">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  "h-10 w-full rounded-lg border border-line bg-paper-2 px-3 text-sm text-ink placeholder:text-ink-3 focus:border-signal";

/** Icons: inline SVG, 20px, currentColor. */
export const Icon = {
  Pin: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M10 18s-6-5.5-6-10a6 6 0 1 1 12 0c0 4.5-6 10-6 10Z" />
      <circle cx="10" cy="8" r="2" />
    </svg>
  ),
  Locate: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="10" cy="10" r="5" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      <path d="M10 2v3M10 15v3M2 10h3M15 10h3" />
    </svg>
  ),
  Swap: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M6 3v11M6 14l-3-3M6 14l3-3M14 17V6M14 6l-3 3M14 6l3 3" />
    </svg>
  ),
  Walk: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="11" cy="3.5" r="1.5" fill="currentColor" />
      <path d="M9 7l-2.5 5M9 7l3 2 2 3M9 7l1 5-3 6M10 12l3 6" />
    </svg>
  ),
  Bus: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <rect x="4" y="3" width="12" height="13" rx="2" />
      <path d="M4 9h12M7 16v2M13 16v2" />
      <circle cx="7" cy="13" r="0.8" fill="currentColor" />
      <circle cx="13" cy="13" r="0.8" fill="currentColor" />
    </svg>
  ),
  Cable: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M2 5l16-2M10 4v4" />
      <rect x="6" y="8" width="8" height="8" rx="2" />
    </svg>
  ),
  Clock: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l3 2" />
    </svg>
  ),
  Share: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M10 3v10M10 3L6.5 6.5M10 3l3.5 3.5M4 11v5h12v-5" />
    </svg>
  ),
  Back: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M12 4l-6 6 6 6" />
    </svg>
  ),
  Close: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  ),
  Alert: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M10 3l8 14H2L10 3Z" />
      <path d="M10 8v4M10 14.5v.5" />
    </svg>
  ),
  Wheelchair: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="9" cy="3.5" r="1.5" fill="currentColor" />
      <path d="M9 6v5h5l2 5M9 9h4" />
      <path d="M7.5 9.5a4.5 4.5 0 1 0 5 6.5" />
    </svg>
  ),
  Sun: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" />
    </svg>
  ),
  Moon: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M16 12.5A7 7 0 0 1 7.5 4a7 7 0 1 0 8.5 8.5Z" />
    </svg>
  ),
  Map: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M3 5l5-2 4 2 5-2v12l-5 2-4-2-5 2V5ZM8 3v12M12 5v12" />
    </svg>
  ),
  List: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M4 5h12M4 10h12M4 15h12" />
    </svg>
  ),
  Chevron: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M8 4l6 6-6 6" />
    </svg>
  ),
  Check: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  ),
  Search: (p: ComponentProps<"svg">) => (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13 13l4 4" />
    </svg>
  ),
};
