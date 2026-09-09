/**
 * Leg two: where Google and Microsoft send the browser back.
 *
 * This exact path is what has to be registered in each provider's console — for production:
 *
 *     https://bogota.opentransit.tech/admin/auth/callback/google
 *     https://bogota.opentransit.tech/admin/auth/callback/microsoft
 *
 * It is a route handler rather than a page on purpose: only server code may read the httpOnly cookie
 * that binds this flow to this browser, and only server code may set the session cookie. Nothing is
 * ever rendered here — every path out is a redirect, so the authorization code never sits in a page
 * the operator could bookmark or paste.
 *
 * The API does all the deciding: it checks the `state` is real, unused and ours, exchanges the code
 * with the PKCE verifier it kept, verifies the id_token, and refuses anybody without an account. This
 * handler only carries the answer to the right cookie.
 */
import { type NextRequest, NextResponse } from "next/server";
import { ADMIN_ENABLED, safeNext } from "@/lib/admin/session";
import {
  OIDC_COOKIE,
  OIDC_NEXT_COOKIE,
  errorForProviderResponse,
  errorForStatus,
  isProviderId,
} from "@/lib/admin/oidc";
import { cookieOptions, sessionCookie } from "@/lib/admin/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiUrl = () =>
  (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001").replace(/\/$/, "");

type Ctx = { params: Promise<{ provider: string }> };

/** Both exits clear the flow cookies: a half-finished sign-in must never be resumable. */
function done(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(OIDC_COOKIE, "", cookieOptions(0));
  res.cookies.set(OIDC_NEXT_COOKIE, "", cookieOptions(0));
  return res;
}

function toLogin(req: NextRequest, error: string): NextResponse {
  const url = new URL("/admin/login", req.nextUrl.origin);
  url.searchParams.set("error", error);
  return done(NextResponse.redirect(url, 303));
}

export async function GET(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  if (!ADMIN_ENABLED) return new NextResponse("Not found", { status: 404 });
  const { provider } = await ctx.params;
  if (!isProviderId(provider)) return new NextResponse("Not found", { status: 404 });

  const q = req.nextUrl.searchParams;
  const providerError = q.get("error");
  if (providerError) return toLogin(req, errorForProviderResponse(providerError));

  const state = q.get("state");
  const code = q.get("code");
  const browserToken = req.cookies.get(OIDC_COOKIE)?.value;
  // No cookie means this browser did not start this flow — a forged callback, or a sign-in left open
  // long enough to expire. Both are "start again", and neither is worth a different message.
  if (!state || !code || !browserToken) return toLogin(req, "expired");

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl()}/v1/admin/auth/oidc/${provider}/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ state, code, browserToken }),
      cache: "no-store",
    });
  } catch {
    return toLogin(req, "unavailable");
  }
  if (!upstream.ok) return toLogin(req, errorForStatus(upstream.status));

  let body: { token?: string; expiresAt?: string };
  try {
    body = await upstream.json();
  } catch {
    return toLogin(req, "failed");
  }
  if (!body.token) return toLogin(req, "failed");

  // `next` was written by us and validated on the way in; re-validating it here — and resolving it
  // against this origin — means even a tampered cookie cannot send the operator off-site.
  const next = safeNext(req.cookies.get(OIDC_NEXT_COOKIE)?.value);
  const res = done(NextResponse.redirect(new URL(next, req.nextUrl.origin), 303));
  const cookie = sessionCookie(body.token, body.expiresAt);
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
