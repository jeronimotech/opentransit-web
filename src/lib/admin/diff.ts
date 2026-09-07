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

const isObject = (v: Json): v is Record<string, Json> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * The merge the server applies to an override (`deep_merge` in
 * `admin_config.py`): nested objects merge key by key, lists and scalars
 * replace, and a key the patch does not carry is inherited from the YAML.
 *
 * The panel has to compute this, not take the override wholesale. An override
 * is a *patch*: Bogotá's is `{config: {assistant: {enabled: true}}}`, meaning
 * "turn it on, and keep everything else from the YAML". Read as if it were the
 * whole section it looks like a city with no fares, no features and an
 * assistant with no key, and the form then refuses to save a configuration
 * that is in fact valid and already running.
 *
 * `null` inherits rather than deletes, and that is deliberate: the admin
 * endpoint masks secrets on the way out and writes `config.assistant.apiKey`
 * as null when the key it is masking is not the panel's to see. Treating that
 * as a deletion would put the operator right back in front of "the assistant is
 * on and has no key".
 */
export function deepMerge<T>(base: T, patch: Json): T {
  if (!isObject(patch)) return (patch === undefined || patch === null ? base : (patch as T));
  const out: Record<string, Json> = isObject(base as Json) ? { ...(base as Record<string, Json>) } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) continue; // inherit
    else if (isObject(v) && isObject(out[k])) out[k] = deepMerge(out[k], v);
    else out[k] = v;
  }
  return out as T;
}

/**
 * What this section will actually be once the override is applied: the YAML
 * with the patch merged on top. A field the patch does not mention, or sets to
 * null, is inherited — it is not an empty field, and it is not an invalid one.
 */
export function effectiveSection<K extends AdminSection>(override: AdminOverride | null | undefined, yaml: AdminEditable, section: K): AdminEditable[K] {
  const o = override?.[section] as Json;
  if (o === undefined || o === null) return yaml[section] as AdminEditable[K];
  return deepMerge(yaml[section], o) as AdminEditable[K];
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
