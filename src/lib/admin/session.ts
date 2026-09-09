/**
 * Admin session, browser side.
 *
 * The session token never reaches this code. `/api/admin/*` (this app's own route handler) holds it in
 * an httpOnly cookie on this origin, so a script running on the page cannot read it and there is
 * nothing in localStorage worth stealing. What lives here are the pure rules the UI needs in order to
 * *show* the right things; the API enforces the same rules again on every request, so a user who edits
 * their own JavaScript gains exactly nothing.
 */

export type AdminRole = "viewer" | "admin" | "owner" | "machine";

export type AdminUser = {
  id: number | null;
  email: string;
  name: string;
  role: AdminRole;
  /** Empty means every city. */
  cities: string[];
  kind: "user" | "machine";
};

/** `NEXT_PUBLIC_ADMIN_ENABLED=0` (or `false`) hides /admin entirely (404). */
export const ADMIN_ENABLED = !["0", "false", "no"].includes(
  (process.env.NEXT_PUBLIC_ADMIN_ENABLED ?? "1").trim().toLowerCase(),
);

/** The machine credential sits at the admin level but never manages accounts — same table as the API. */
const RANK: Record<AdminRole, number> = { viewer: 1, admin: 2, machine: 2, owner: 3 };

export function hasRole(user: AdminUser | null | undefined, minimum: AdminRole): boolean {
  return !!user && (RANK[user.role] ?? 0) >= (RANK[minimum] ?? 99);
}

/** May change city configuration. */
export function canEdit(user: AdminUser | null | undefined): boolean {
  return hasRole(user, "admin");
}

export function canManageUsers(user: AdminUser | null | undefined): boolean {
  return !!user && user.kind === "user" && user.role === "owner";
}

export function cityAllowed(user: AdminUser | null | undefined, city: string): boolean {
  return !!user && (user.cities.length === 0 || user.cities.includes(city));
}

/** "Luis" if we know it, otherwise the email — what the header shows next to Sign out. */
export function displayName(user: AdminUser | null | undefined): string {
  if (!user) return "";
  return user.name || user.email || "machine";
}

export function scopeLabel(user: AdminUser | null | undefined, allCitiesLabel: string): string {
  return !user || user.cities.length === 0 ? allCitiesLabel : user.cities.join(", ");
}

/**
 * Where to go after signing in. A `?next=` that a stranger can set is an open-redirect waiting to
 * happen, so only a path inside /admin is honoured — never an absolute URL, a protocol-relative one
 * (`//evil.example`), or a scheme.
 */
export function safeNext(next: string | null | undefined, fallback = "/admin"): string {
  if (!next) return fallback;
  const raw = next.trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw.includes("\\") || /[\x00-\x1f]/.test(raw)) return fallback;
  const path = raw.split(/[?#]/)[0];
  if (path !== "/admin" && !path.startsWith("/admin/")) return fallback;
  if (path.startsWith("/admin/login")) return fallback;
  return raw;
}

/** The current location as a `next` value, tab included, so expiry never costs the operator their place. */
export function hereAsNext(loc: { pathname: string; search: string; hash: string }): string {
  return `${loc.pathname}${loc.search}${loc.hash}`;
}
