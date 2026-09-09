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
  // `providers` is readable without a session on purpose: the login screen has to know which buttons to
  // draw before anybody has signed in. It answers with names, never with credentials.
  if (head === "auth" && rest.length === 1 && ["login", "logout", "me", "providers"].includes(rest[0])) {
    return `/v1/admin/auth/${rest[0]}`;
  }
  // The provider sign-in endpoints are deliberately *not* reachable here. They are driven by this app's
  // own route handlers (src/app/api/admin/oidc, src/app/admin/auth/callback), which hold the browser
  // token in an httpOnly cookie; relaying them through the generic proxy would put that token on the page.
  if (head === "auth" && rest[0] === "oidc") return null;
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

export type CookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

/**
 * How every cookie this app sets on behalf of the admin session is written. One definition, because a
 * flow that forgets `httpOnly` on one of its three branches is a flow that leaks a session.
 *
 * `sameSite: "lax"` rather than `strict` is required, not lazy: the browser comes back from Google or
 * Microsoft as a top-level navigation from another site, and a strict cookie would not be sent.
 */
export function cookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** The session cookie itself, from whatever the API said about expiry. `maxAge: 0` clears it. */
export function sessionCookie(token: string, expiresAt?: string, now = Date.now()) {
  return { name: SESSION_COOKIE, value: token, options: cookieOptions(cookieMaxAge(expiresAt, now)) };
}
