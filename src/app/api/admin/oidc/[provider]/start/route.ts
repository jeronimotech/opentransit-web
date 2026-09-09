/**
 * Leg one of "sign in with Google / Microsoft": a full-page navigation that ends at the provider.
 *
 * The login screen links here rather than fetching, because the answer is a redirect off-site. This
 * handler asks the API to begin a flow — the API mints `state`, the PKCE verifier and the nonce, and
 * keeps all three — and stores the two things the browser must carry back in httpOnly cookies. The page
 * never sees them, which is what makes the returning `state` worth anything: an attacker who can make
 * your browser hit the callback still cannot produce the token that proves the flow started here.
 *
 * `API_URL` is read at request time on the server, exactly as in the session proxy next door.
 */
import { type NextRequest, NextResponse } from "next/server";
import { ADMIN_ENABLED, safeNext } from "@/lib/admin/session";
import {
  OIDC_COOKIE,
  OIDC_COOKIE_MAX_AGE,
  OIDC_NEXT_COOKIE,
  isProviderAuthorizeUrl,
  isProviderId,
} from "@/lib/admin/oidc";
import { cookieOptions } from "@/lib/admin/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiUrl = () =>
  (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001").replace(/\/$/, "");

type Ctx = { params: Promise<{ provider: string }> };

/** Every failure lands back on the login screen with a code, never with the API's own words. */
function toLogin(req: NextRequest, error: string): NextResponse {
  const url = new URL("/admin/login", req.nextUrl.origin);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

export async function GET(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  if (!ADMIN_ENABLED) return new NextResponse("Not found", { status: 404 });
  const { provider } = await ctx.params;
  if (!isProviderId(provider)) return new NextResponse("Not found", { status: 404 });

  // Decided here, before the round trip, so nothing a stranger typed ever reaches the API or the
  // provider: only a path inside /admin survives `safeNext`.
  const next = safeNext(req.nextUrl.searchParams.get("next"));

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl()}/v1/admin/auth/oidc/${provider}/start`, {
      method: "POST",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return toLogin(req, "unavailable");
  }
  if (!upstream.ok) return toLogin(req, upstream.status === 429 ? "failed" : "unavailable");

  let body: { authorizationUrl?: string; state?: string; browserToken?: string };
  try {
    body = await upstream.json();
  } catch {
    return toLogin(req, "unavailable");
  }
  // A redirect we did not sanity-check is a redirect somebody else gets to choose.
  if (!body.browserToken || !isProviderAuthorizeUrl(provider, body.authorizationUrl)) {
    return toLogin(req, "unavailable");
  }

  const res = NextResponse.redirect(body.authorizationUrl!, 303);
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(OIDC_COOKIE, body.browserToken, cookieOptions(OIDC_COOKIE_MAX_AGE));
  res.cookies.set(OIDC_NEXT_COOKIE, next, cookieOptions(OIDC_COOKIE_MAX_AGE));
  return res;
}
