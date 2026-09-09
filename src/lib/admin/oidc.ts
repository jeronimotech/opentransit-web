/**
 * Sign in with Google or Microsoft — the browser-side half.
 *
 * Everything that could be a secret stays on the server. The page never sees an authorization code, a
 * `state`, or the browser token that binds the flow; two route handlers on this origin
 * (`/api/admin/oidc/[provider]/start` and `/admin/auth/callback/[provider]`) hold them in httpOnly
 * cookies and hand the API's session token straight into the same cookie the password flow uses. What
 * lives here are the pure rules both handlers need, so they can be tested without a browser.
 *
 * The API decides which providers exist; this file only knows how to talk about them.
 */

export const PROVIDERS = ["google", "microsoft"] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export type AdminProvider = { id: string; label: string };
export type AdminProviders = { password: boolean; providers: AdminProvider[] };

export function isProviderId(value: string | null | undefined): value is ProviderId {
  return !!value && (PROVIDERS as readonly string[]).includes(value);
}

/** The cookie that binds a sign-in to the browser that started it. Server-only, dies with the flow. */
export const OIDC_COOKIE = "ot_admin_oidc";
/** Where to land afterwards. Kept here rather than in `state` so the API never has to trust a path. */
export const OIDC_NEXT_COOKIE = "ot_admin_oidc_next";
/** A minute longer than the API's own state TTL, so the cookie is never the first thing to expire. */
export const OIDC_COOKIE_MAX_AGE = 660;

/**
 * The only hosts a provider may send us to. The authorization URL is built by our own API, so this is
 * belt and braces — but "our own API" is exactly the assumption an SSRF or a bad deploy breaks, and the
 * cost of being wrong is a full-page redirect to somebody else's login form.
 */
const AUTHORIZE_HOSTS: Record<ProviderId, string> = {
  google: "accounts.google.com",
  microsoft: "login.microsoftonline.com",
};

export function isProviderAuthorizeUrl(provider: string, url: string | undefined | null): boolean {
  if (!isProviderId(provider) || !url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && parsed.hostname === AUTHORIZE_HOSTS[provider];
}

/** The exact path to register in each provider's console, given this deployment's public origin. */
export function callbackPath(provider: ProviderId): string {
  return `/admin/auth/callback/${provider}`;
}

/**
 * Why a sign-in did not happen, as a short code in the URL rather than a message.
 *
 * The API's own wording is fine to read but not fine to reflect: putting upstream text into a query
 * string is how an attacker gets to write the sentence next to your password box. The login page turns
 * one of these into a translated string of its own.
 */
export const OIDC_ERRORS = ["cancelled", "expired", "no_account", "unavailable", "failed"] as const;
export type OidcError = (typeof OIDC_ERRORS)[number];

export function isOidcError(value: string | null | undefined): value is OidcError {
  return !!value && (OIDC_ERRORS as readonly string[]).includes(value);
}

/** Map the API's status onto something a person can act on. 403 is the interesting one: "ask an owner". */
export function errorForStatus(status: number): OidcError {
  if (status === 403) return "no_account";
  if (status === 401) return "expired";
  if (status === 404 || status === 503) return "unavailable";
  return "failed";
}

/** What the provider itself reports when the person pressed Cancel rather than Allow. */
export function errorForProviderResponse(error: string): OidcError {
  return error === "access_denied" || error === "consent_required" ? "cancelled" : "failed";
}
