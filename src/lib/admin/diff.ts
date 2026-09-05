import type { AdminEditable, AdminOverride, AdminSection } from "../api/types";

type Json = unknown;

/** Flatten nested objects/arrays into "a.b.0.c" → leaf pairs. */
export function flatten(v: Json, prefix = "", out: Record<string, Json> = {}): Record<string, Json> {
  if (v === null || typeof v !== "object") {
    out[prefix || "$"] = v;
    return out;
  }
  const entries = Array.isArray(v) ? v.map((x, i) => [String(i), x] as const) : Object.entries(v as Record<string, Json>);
  if (entries.length === 0) {
    out[prefix || "$"] = Array.isArray(v) ? [] : {};
    return out;
  }
  for (const [k, x] of entries) flatten(x, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

export function deepEqual(a: Json, b: Json): boolean {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}
function sortKeys(v: Json): Json {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, Json>)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, Json>)[k])]),
    );
  }
  return v;
}

export type Change = { path: string; kind: "added" | "changed" | "removed"; from?: Json; to?: Json };

/** Diff summary between two override snapshots (history rows). */
export function changedKeys(prev: AdminOverride | null | undefined, next: AdminOverride | null | undefined): Change[] {
  const a = flatten(prev ?? {});
  const b = flatten(next ?? {});
  const out: Change[] = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k === "$") continue;
    const inA = k in a;
    const inB = k in b;
    if (inA && !inB) out.push({ path: k, kind: "removed", from: a[k] });
    else if (!inA && inB) out.push({ path: k, kind: "added", to: b[k] });
    else if (!deepEqual(a[k], b[k])) out.push({ path: k, kind: "changed", from: a[k], to: b[k] });
  }
  return out.sort((x, y) => x.path.localeCompare(y.path));
}

/** Is this whole section carrying an override (vs. straight from YAML)? */
export function sectionOverridden(override: AdminOverride | null | undefined, section: AdminSection): boolean {
  return !!override && override[section] !== undefined && override[section] !== null;
}

/** Is a single field's effective value different from the YAML one? */
export function fieldOverridden<K extends AdminSection>(
  override: AdminOverride | null | undefined,
  yaml: AdminEditable,
  section: K,
  path: string,
): boolean {
  if (!sectionOverridden(override, section)) return false;
  const o = flatten(override![section]);
  const y = flatten(yaml[section]);
  return path in o && !deepEqual(o[path], y[path]);
}

/** Effective section value = override when present, else YAML. */
export function effectiveSection<K extends AdminSection>(override: AdminOverride | null | undefined, yaml: AdminEditable, section: K): AdminEditable[K] {
  const o = override?.[section];
  return (o !== undefined && o !== null ? o : yaml[section]) as AdminEditable[K];
}

const SECTIONS: AdminSection[] = ["fares", "config", "links", "services", "branding", "mobility", "landing"];

/** What the app effectively sees for a snapshot: each section from the override, else YAML. */
export function effectiveSnapshot(override: AdminOverride | null | undefined, yaml: AdminEditable): AdminEditable {
  return Object.fromEntries(SECTIONS.map((s) => [s, effectiveSection(override, yaml, s)])) as AdminEditable;
}

/** History diff in terms of effective values, so revision 1 shows "~ fares.base", not every key. */
export function effectiveChanges(prev: AdminOverride | null | undefined, next: AdminOverride | null | undefined, yaml: AdminEditable): Change[] {
  return changedKeys(effectiveSnapshot(prev, yaml) as AdminOverride, effectiveSnapshot(next, yaml) as AdminOverride);
}
