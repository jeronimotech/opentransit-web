# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Use GitHub's private reporting: **Security → Report a vulnerability** on this repository
(https://github.com/jeronimotech/opentransit-web/security/advisories/new). You will get an
acknowledgement within 5 working days and a fix or mitigation plan within 30 days for confirmed issues.

## Scope

- This web client (Next.js) and its build/deploy configuration.
- The `/admin` section: the operator token is kept in `sessionStorage` only, sent as `X-Admin-Token`,
  and never written to the URL or logs. Always serve the app over HTTPS and rotate `ADMIN_TOKEN` on the API.
- Content rendered from city configuration (landing page, services, links): only `https://` URLs are accepted.

Backend issues belong to `opentransit-api`; mobile issues to `opentransit-mobile`.

## Supported versions

The `main` branch and the latest tagged release receive fixes.
