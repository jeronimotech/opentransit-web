/**
 * Path rules for the `/api/admin/*` session proxy (see `src/app/api/admin/[...path]/route.ts`).
 *
 * The proxy attaches the operator's session to every request it forwards, so an unconstrained one
 * would be an open relay with credentials attached: anybody could aim it at any API path. Only the
 * shapes below are reachable; everything else is a 404 before a single byte leaves this server.
 */

export const SESSION_COOKIE = "ot_admin_session";

/** Requests this proxy may make on the operator's behalf, given `/api/admin/<segments>`. */
export function targetPath(segments: string[]): string | null {
  if (!segments.length || segments.length > 6) return null;
  if (segments.some((s) => !s || s === "." || s === ".." || s.includes("/") || s.includes("\\"))) return null;
  const [head, ...rest] = segments;
  const enc = (s: string) => encodeURIComponent(s);

  if (head === "me" && rest.length === 0) return "/v1/admin/me";
  if (head === "auth" && rest.length === 1 && ["login", "logout", "me"].includes(rest[0])) {
    return `/v1/admin/auth/${rest[0]}`;
  }
  if (head === "users") {
    if (rest.length === 0) return "/v1/admin/users";
    if (rest.length === 1) return `/v1/admin/users/${enc(rest[0])}`;
    if (rest.length === 2 && rest[1] === "disable") return `/v1/admin/users/${enc(rest[0])}/disable`;
    return null;
  }
  if (head === "cities" && rest.length >= 2) {
    const [city, ...tail] = rest;
    return `/v1/admin/cities/${enc(city)}/${tail.map(enc).join("/")}`;
  }
  // The assistant's health check is admin-guarded but lives on the public city path, so it needs a
  // rule of its own rather than a hole in the one above.
  if (head === "chat-health" && rest.length === 1) return `/v1/cities/${enc(rest[0])}/chat/health`;
  return null;
}

/** Cookie lifetime from the API's `expiresAt`, clamped so a clock skew can never mint a forever cookie. */
export function cookieMaxAge(expiresAt: string | undefined, now = Date.now()): number {
  const ms = expiresAt ? Date.parse(expiresAt) - now : NaN;
  if (!Number.isFinite(ms)) return 60 * 60 * 8;
  return Math.max(60, Math.min(Math.floor(ms / 1000), 60 * 60 * 24 * 30));
}
