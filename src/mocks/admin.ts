/**
 * In-memory admin store for NEXT_PUBLIC_MOCK=1: overrides + history, reset on reload.
 * Demo token: "demo" (also "change-me", the API's default).
 */
import { ApiRequestError } from "@/lib/api/client";
import { EN_MESSAGES, validateSection } from "@/lib/admin/validate";
import type {
  AdminConfigPatch,
  AdminConfigResponse,
  AdminEditable,
  AdminHistoryItem,
  AdminOverride,
  AdminSection,
  City,
} from "@/lib/api/types";
import { city as yamlCity, landing as yamlLanding } from "./data";
import type { CityLanding } from "@/lib/api/types";

const TOKENS = new Set(["demo", "change-me"]);
const SECTIONS: AdminSection[] = ["fares", "config", "links", "services", "branding", "mobility", "landing"];

const state = {
  override: null as AdminOverride | null,
  revision: 0,
  updatedAt: null as string | null,
  updatedBy: null as string | null,
  history: [] as AdminHistoryItem[],
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function yaml(): AdminEditable {
  return {
    fares: clone(yamlCity.fares ?? null),
    config: clone(yamlCity.config ?? null),
    links: clone(yamlCity.links ?? null),
    services: clone(yamlCity.services ?? null),
    branding: { primaryColor: yamlCity.branding.primaryColor },
    mobility: clone(yamlCity.mobility ?? null),
    landing: clone(yamlLanding),
  };
}

/** The landing as `/landing` would serve it: YAML with the override applied. */
export function effectiveLanding(): CityLanding {
  return clone(state.override?.landing ?? yamlLanding);
}

/** The city as the public API would serve it: YAML with overrides applied. */
export function effectiveCity(): City {
  const c = clone(yamlCity);
  const o = state.override;
  if (!o) return c;
  if (o.fares) c.fares = clone(o.fares);
  if (o.config) c.config = clone(o.config);
  if (o.links) c.links = clone(o.links);
  if (o.services) c.services = clone(o.services);
  if (o.branding) c.branding = { ...c.branding, primaryColor: o.branding.primaryColor };
  if (o.mobility) {
    c.mobility = clone(o.mobility);
    c.features.bikeShare = (o.mobility.bikeShare ?? []).length > 0;
  }
  if (o.landing) c.landing = clone(o.landing);
  return c;
}

function response(): AdminConfigResponse {
  return {
    effective: effectiveCity(),
    override: state.override ? clone(state.override) : null,
    yaml: yaml(),
    revision: state.revision,
    updatedAt: state.updatedAt,
    updatedBy: state.updatedBy,
  };
}

function requireToken(headers: Record<string, string>) {
  const tok = headers["X-Admin-Token"] ?? headers["x-admin-token"];
  if (!tok || !TOKENS.has(tok)) throw new ApiRequestError(401, "UNAUTHORIZED", "missing or invalid X-Admin-Token");
}

function commit(next: AdminOverride | null, by: string | null, note: string | null) {
  state.override = next && Object.keys(next).length ? next : null;
  state.revision += 1;
  state.updatedAt = new Date().toISOString();
  state.updatedBy = by;
  state.history.unshift({ revision: state.revision, changedAt: state.updatedAt, changedBy: by, note, data: state.override ? clone(state.override) : null });
  state.history = state.history.slice(0, 50);
}

export function adminMock<T>(path: string, q: Record<string, unknown>, init: { method: string; body: string | null; headers: Record<string, string> }): T {
  requireToken(init.headers);
  if (path === "/v1/admin/me") return { ok: true, cities: ["bogota"] } as T;
  const m = path.match(/^\/v1\/admin\/cities\/([^/]+)\/config(\/history)?$/);
  if (!m) throw new ApiRequestError(404, "NOT_FOUND", `No mock for ${path}`);
  if (m[1] !== "bogota") throw new ApiRequestError(404, "CITY_NOT_FOUND", `No city with id ${m[1]}`);

  if (m[2]) {
    const limit = Math.max(1, Math.min(100, Number(q.limit ?? 20)));
    return { items: state.history.slice(0, limit) } as T;
  }
  if (init.method === "GET") return response() as T;
  if (init.method === "DELETE") {
    commit(null, null, "reset");
    return response() as T;
  }
  if (init.method === "PUT") {
    let patch: AdminConfigPatch;
    try {
      patch = JSON.parse(init.body ?? "{}") as AdminConfigPatch;
    } catch {
      throw new ApiRequestError(400, "BAD_REQUEST", "body must be JSON");
    }
    const next: AdminOverride = clone(state.override ?? {});
    const details: { path: string; message: string }[] = [];
    for (const s of SECTIONS) {
      if (!(s in patch)) continue;
      const v = patch[s];
      if (v === null) {
        delete next[s];
        continue;
      }
      const errs = validateSection(s, v as AdminEditable[typeof s], EN_MESSAGES);
      for (const [p, msg] of Object.entries(errs)) details.push({ path: p, message: msg });
      // fares.estimated is always true: operators can only estimate, never publish official fares
      (next as Record<string, unknown>)[s] = s === "fares" ? { ...(v as object), estimated: true } : clone(v);
    }
    if (details.length) throw new ApiRequestError(400, "BAD_REQUEST", "validation failed", details);
    commit(next, patch.updatedBy?.trim() || null, patch.note?.trim() || null);
    return response() as T;
  }
  throw new ApiRequestError(405, "METHOD_NOT_ALLOWED", init.method);
}
