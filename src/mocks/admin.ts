/**
 * In-memory admin store for NEXT_PUBLIC_MOCK=1: accounts, overrides and history, reset on reload.
 * Demo account: demo@opentransit.dev / demo-password. There is no server here to hold an httpOnly
 * cookie, so the "session" is a module variable — enough to walk through the screens.
 */
import { ApiRequestError } from "@/lib/api/client";
import { EN_MESSAGES, validateSection } from "@/lib/admin/validate";
import { PROVIDER_NAMES } from "@/lib/assistant";
import type {
  AdminConfigPatch,
  AdminConfigResponse,
  AdminEditable,
  AdminHistoryItem,
  AdminOverride,
  AdminSection,
  AssistantConfig,
  City,
  CityConfig,
} from "@/lib/api/types";
import { city as yamlCity, landing as yamlLanding } from "./data";
import type { CityLanding } from "@/lib/api/types";

const DEMO_PASSWORD = "demo-password";
type MockUser = { id: number; email: string; name: string; role: "viewer" | "admin" | "owner"; cities: string[]; disabled: boolean; createdAt: string; lastLoginAt: string | null; password: string };
const users: MockUser[] = [
  { id: 1, email: "demo@opentransit.dev", name: "Demo", role: "owner", cities: [], disabled: false, createdAt: new Date().toISOString(), lastLoginAt: null, password: DEMO_PASSWORD },
];
let session: MockUser | null = null;
let nextUserId = 2;

const publicUser = (u: MockUser) => ({ id: u.id, email: u.email, name: u.name, role: u.role, cities: u.cities, disabled: u.disabled, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt });
const principal = (u: MockUser) => ({ id: u.id, email: u.email, name: u.name, role: u.role, cities: u.cities, kind: "user" as const });
const RANK = { viewer: 1, admin: 2, owner: 3 };
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
  const config = clone(yamlCity.config ?? null);
  maskAssistant(config);
  return {
    fares: clone(yamlCity.fares ?? null),
    config,
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
    c.features.onDemand = (o.mobility.onDemand ?? []).some((p) => p.enabled);
  }
  if (o.landing) c.landing = clone(o.landing);
  return c;
}

const MASK = /^[•*]{2,}/;
const mask = (v: string) => `••••${v.slice(-4)}`;

/** Credentials never leave the store in clear: "••••" + last 4 chars, like the API. */
function maskOverride(o: AdminOverride | null): AdminOverride | null {
  if (!o) return o;
  const m = clone(o);
  if (m.mobility?.onDemand) m.mobility.onDemand = m.mobility.onDemand.map((p) => (p.credentials?.clientId ? { ...p, credentials: { clientId: mask(p.credentials.clientId) } } : p));
  maskAssistant(m.config as CityConfig | null | undefined);
  return m;
}

/** The assistant key follows the same rule as the on-demand credentials. */
function maskAssistant(c: CityConfig | null | undefined): void {
  const a = c?.assistant as AssistantConfig | null | undefined;
  if (a?.apiKey && !MASK.test(a.apiKey)) a.apiKey = mask(a.apiKey);
}

/**
 * What the public `/cities/{id}` serves: the assistant is reduced to the slice a
 * client is allowed to see. The key never reaches a browser, masked or not.
 */
export function publicCity(): City {
  const c = effectiveCity();
  const a = c.config?.assistant as AssistantConfig | null | undefined;
  if (c.config && a) {
    c.config.assistant = { enabled: !!a.enabled, provider: a.provider, providerName: PROVIDER_NAMES[a.provider] ?? null, model: a.model ?? null };
  }
  return c;
}

function response(): AdminConfigResponse {
  const effective = effectiveCity();
  maskAssistant(effective.config);
  return {
    effective,
    override: maskOverride(state.override ? clone(state.override) : null),
    yaml: yaml(),
    revision: state.revision,
    updatedAt: state.updatedAt,
    updatedBy: state.updatedBy,
  };
}

export function requireAdmin() {
  requireSession();
}

/** Demo sign-in for tests and screenshots; the app itself goes through `/v1/admin/auth/login`. */
export function signInDemo(role: MockUser["role"] = "owner"): void {
  users[0].role = role;
  session = users[0];
}

function requireSession(minimum: "viewer" | "admin" | "owner" = "viewer"): MockUser {
  if (!session) throw new ApiRequestError(401, "UNAUTHORIZED", "not signed in");
  if (RANK[session.role] < RANK[minimum]) throw new ApiRequestError(403, "FORBIDDEN", `this action needs the ${minimum} role`);
  return session;
}

function requireCity(user: MockUser, city: string) {
  if (user.cities.length && !user.cities.includes(city)) {
    throw new ApiRequestError(403, "FORBIDDEN", `your account is not scoped to ${city}`);
  }
}

/** The auth endpoints, and the account list behind them. Returns null when `path` is something else. */
function authMock<T>(path: string, init: { method: string; body: string | null }): T | null {
  const body = () => JSON.parse(init.body ?? "{}") as Record<string, unknown>;
  if (path === "/v1/admin/auth/login") {
    const { email, password } = body() as { email?: string; password?: string };
    const u = users.find((x) => x.email.toLowerCase() === (email ?? "").trim().toLowerCase());
    if (!u || u.disabled || u.password !== password) throw new ApiRequestError(401, "UNAUTHORIZED", "wrong email or password");
    u.lastLoginAt = new Date().toISOString();
    session = u;
    return { expiresAt: new Date(Date.now() + 12 * 3600_000).toISOString(), user: publicUser(u), cities: ["bogota"] } as T;
  }
  if (path === "/v1/admin/auth/logout") {
    session = null;
    return { ok: true } as T;
  }
  if (path === "/v1/admin/auth/me" || path === "/v1/admin/me") {
    const u = requireSession();
    return { ok: true, user: principal(u), cities: ["bogota"], canManageUsers: u.role === "owner" } as T;
  }
  if (path === "/v1/admin/users") {
    requireSession("owner");
    if (init.method === "GET") return { users: users.map(publicUser) } as T;
    const b = body() as { email?: string; password?: string; name?: string; role?: MockUser["role"]; cities?: string[] };
    const email = (b.email ?? "").trim();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new ApiRequestError(409, "CONFLICT", "email: an account with that email already exists");
    }
    if ((b.password ?? "").length < 12) throw new ApiRequestError(422, "BAD_REQUEST", "password: must be at least 12 characters");
    const u: MockUser = { id: nextUserId++, email, name: b.name ?? "", role: b.role ?? "viewer", cities: b.cities ?? [], disabled: false, createdAt: new Date().toISOString(), lastLoginAt: null, password: b.password! };
    users.push(u);
    return publicUser(u) as T;
  }
  const m = path.match(/^\/v1\/admin\/users\/(\d+)(\/disable)?$/);
  if (m) {
    requireSession("owner");
    const u = users.find((x) => x.id === Number(m[1]));
    if (!u) throw new ApiRequestError(404, "NOT_FOUND", `no account with id ${m[1]}`);
    const others = users.filter((x) => x.role === "owner" && !x.disabled && x.id !== u.id);
    if (m[2]) {
      if (u.role === "owner" && !others.length) throw new ApiRequestError(409, "CONFLICT", "this is the last enabled owner");
      u.disabled = true;
      if (session?.id === u.id) session = null;
      return publicUser(u) as T;
    }
    const b = body() as { name?: string; role?: MockUser["role"]; cities?: string[]; disabled?: boolean; password?: string };
    if (u.role === "owner" && !others.length && (b.disabled || (b.role && b.role !== "owner"))) {
      throw new ApiRequestError(409, "CONFLICT", "this is the last enabled owner");
    }
    if (b.name !== undefined) u.name = b.name;
    if (b.role !== undefined) u.role = b.role;
    if (b.cities !== undefined) u.cities = b.cities;
    if (b.disabled !== undefined) u.disabled = b.disabled;
    if (b.password) u.password = b.password;
    return publicUser(u) as T;
  }
  return null;
}

function commit(next: AdminOverride | null, by: string | null, note: string | null) {
  state.override = next && Object.keys(next).length ? next : null;
  state.revision += 1;
  state.updatedAt = new Date().toISOString();
  state.updatedBy = by;
  state.history.unshift({ revision: state.revision, changedAt: state.updatedAt, changedBy: by, note, data: maskOverride(state.override ? clone(state.override) : null) });
  state.history = state.history.slice(0, 50);
}

export function adminMock<T>(path: string, q: Record<string, unknown>, init: { method: string; body: string | null; headers: Record<string, string> }): T {
  const auth = authMock<T>(path, init);
  if (auth !== null) return auth;
  const m = path.match(/^\/v1\/admin\/cities\/([^/]+)\/config(\/history)?$/);
  if (!m) throw new ApiRequestError(404, "NOT_FOUND", `No mock for ${path}`);
  const me = requireSession(init.method === "GET" ? "viewer" : "admin");
  requireCity(me, m[1]);
  if (m[1] !== "bogota") throw new ApiRequestError(404, "CITY_NOT_FOUND", `No city with id ${m[1]}`);

  if (m[2]) {
    const limit = Math.max(1, Math.min(100, Number(q.limit ?? 20)));
    return { items: state.history.slice(0, limit) } as T;
  }
  if (init.method === "GET") return response() as T;
  if (init.method === "DELETE") {
    commit(null, me.email, "reset");
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
      if (s === "config") {
        // a masked assistant key means "keep what is stored" (YAML or the previous override)
        const cur = next.config?.assistant as AssistantConfig | null | undefined;
        if (cur?.apiKey && MASK.test(cur.apiKey)) {
          const storedKey = ((state.override?.config?.assistant ?? yamlCity.config?.assistant) as AssistantConfig | null | undefined)?.apiKey ?? null;
          cur.apiKey = storedKey;
        }
      }
      if (s === "mobility") {
        // a masked client id means "keep what is stored" (YAML or the previous override)
        const stored = new Map((state.override?.mobility?.onDemand ?? yamlCity.mobility?.onDemand ?? []).map((p) => [p.id, p.credentials?.clientId ?? null]));
        const m = next.mobility!;
        m.onDemand = (m.onDemand ?? []).map((p) => (p.credentials?.clientId && MASK.test(p.credentials.clientId) ? { ...p, credentials: { clientId: stored.get(p.id) ?? null } } : p));
      }
    }
    if (details.length) throw new ApiRequestError(400, "BAD_REQUEST", "validation failed", details);
    commit(next, me.email, patch.note?.trim() || null);
    return response() as T;
  }
  throw new ApiRequestError(405, "METHOD_NOT_ALLOWED", init.method);
}
