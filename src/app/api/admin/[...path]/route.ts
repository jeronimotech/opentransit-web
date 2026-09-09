/**
 * The admin session proxy.
 *
 * The browser never sees the session token: it signs in against this route, which keeps the token in
 * an httpOnly cookie on the web's own origin and replays it as a bearer token to the API. That also
 * sidesteps third-party-cookie rules, since the API usually lives on another domain.
 *
 * `API_URL` is read at request time on the server, so it can differ from the public
 * `NEXT_PUBLIC_API_URL` the browser uses (an internal hostname on Railway, for instance).
 */
import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, cookieOptions, sessionCookie, targetPath } from "@/lib/admin/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiUrl = () =>
  (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001").replace(/\/$/, "");

type Ctx = { params: Promise<{ path: string[] }> };

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function forward(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { path } = await ctx.params;
  const target = targetPath(path ?? []);
  if (!target) return fail(404, "NOT_FOUND", "no such admin endpoint");

  // Sign-in and the provider list are the two things a stranger is allowed to ask for: one is how you
  // get a session, the other is which buttons the login screen should draw.
  const isLogin = target === "/v1/admin/auth/login";
  const open = isLogin || target === "/v1/admin/auth/providers";
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (!session && !open) return fail(401, "UNAUTHORIZED", "not signed in");

  const headers: Record<string, string> = { Accept: "application/json" };
  if (session) headers.Authorization = `Bearer ${session}`;
  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  const ua = req.headers.get("user-agent");
  if (ua) headers["User-Agent"] = ua;             // the API stores it on the session row

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl()}${target}${req.nextUrl.search}`, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    return fail(502, "API_UNREACHABLE", "could not reach the API");
  }

  const text = await upstream.text();
  if (isLogin && upstream.ok) return signIn(text);

  const res = new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
  // A revoked or expired session leaves a cookie that can only produce more 401s.
  if (upstream.status === 401 && session) clear(res);
  if (target === "/v1/admin/auth/logout") clear(res);
  return res;
}

/** Move the token out of the response body and into the cookie: it must never reach the page. */
function signIn(text: string): NextResponse {
  let body: { token?: string; expiresAt?: string } & Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(502, "API_UNREACHABLE", "unexpected sign-in response");
  }
  const { token, ...rest } = body;
  if (!token) return fail(502, "API_UNREACHABLE", "sign-in response carried no session");
  const res = NextResponse.json(rest, { headers: { "Cache-Control": "no-store" } });
  const cookie = sessionCookie(token, body.expiresAt as string | undefined);
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}

function clear(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
