# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Use GitHub's private reporting: **Security → Report a vulnerability** on this repository
(https://github.com/jeronimotech/opentransit-web/security/advisories/new). You will get an
acknowledgement within 5 working days and a fix or mitigation plan within 30 days for confirmed issues.

## Scope

- This web client (Next.js) and its build/deploy configuration.
- The `/admin` section. Operators sign in with a named account; **the session token never reaches the page**.
  The route handler at `/api/admin/*` on this origin holds it in an `HttpOnly; Secure; SameSite=Lax` cookie
  and replays it to the API as a bearer token, forwarding only the paths listed in `src/lib/admin/proxy.ts`.
  Nothing that could be replayed is kept in `localStorage` or `sessionStorage`. Always serve over HTTPS.
- **Sign in with Google / Microsoft.** The whole OpenID Connect flow is server-side: two route handlers,
  `/api/admin/oidc/[provider]/start` to begin it and `/admin/auth/callback/[provider]` to finish it, so
  the authorization code, the `state` and the token that binds a flow to one browser stay in httpOnly
  cookies and never touch page JavaScript. The API validates the id_token and decides who may in — a
  provider sign-in never creates an account (see `SECURITY.md` in `opentransit-api`). Two rules are enforced
  here as well: the authorization URL we redirect to must be `https` on that provider's own host, and the
  post-sign-in destination must be a path inside `/admin` (`safeNext`), so neither leg can become an open
  redirect. A failure comes back as one of a fixed set of short codes, never as text from upstream.
- Content rendered from city configuration (landing page, services, links): only `https://` URLs are accepted.

Backend issues belong to `opentransit-api`; mobile issues to `opentransit-mobile`.

## Supported versions

The `main` branch and the latest tagged release receive fixes.
