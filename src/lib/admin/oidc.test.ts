import { describe, expect, it } from "vitest";
import {
  OIDC_COOKIE,
  OIDC_COOKIE_MAX_AGE,
  OIDC_NEXT_COOKIE,
  callbackPath,
  errorForProviderResponse,
  errorForStatus,
  isOidcError,
  isProviderAuthorizeUrl,
  isProviderId,
} from "./oidc";
import { cookieOptions, sessionCookie, targetPath } from "./proxy";
import { safeNext } from "./session";

describe("providers", () => {
  it("knows only the two it implements", () => {
    expect(isProviderId("google")).toBe(true);
    expect(isProviderId("microsoft")).toBe(true);
    for (const bad of ["okta", "GOOGLE", "", null, undefined, "../google", "google/"]) {
      expect(isProviderId(bad)).toBe(false);
    }
  });

  it("registers one callback path per provider", () => {
    // These exact strings go in the Google and Entra consoles; changing one breaks a live deployment.
    expect(callbackPath("google")).toBe("/admin/auth/callback/google");
    expect(callbackPath("microsoft")).toBe("/admin/auth/callback/microsoft");
  });
});

describe("the authorization URL we are willing to follow", () => {
  it("accepts each provider's own https host", () => {
    expect(isProviderAuthorizeUrl("google", "https://accounts.google.com/o/oauth2/v2/auth?client_id=x")).toBe(true);
    expect(
      isProviderAuthorizeUrl("microsoft", "https://login.microsoftonline.com/tid/oauth2/v2.0/authorize?client_id=x"),
    ).toBe(true);
  });

  it("refuses anything else, including the other provider's host", () => {
    for (const bad of [
      "https://accounts.google.com.evil.example/o/oauth2/v2/auth",
      "https://evil.example/o/oauth2/v2/auth",
      "http://accounts.google.com/o/oauth2/v2/auth", // downgraded
      "//accounts.google.com/o/oauth2/v2/auth",
      "javascript:alert(1)",
      "/admin",
      "",
    ]) {
      expect(isProviderAuthorizeUrl("google", bad)).toBe(false);
    }
    expect(isProviderAuthorizeUrl("google", "https://login.microsoftonline.com/x/authorize")).toBe(false);
    expect(isProviderAuthorizeUrl("microsoft", "https://accounts.google.com/o/oauth2/v2/auth")).toBe(false);
    expect(isProviderAuthorizeUrl("okta", "https://accounts.google.com/o/oauth2/v2/auth")).toBe(false);
  });
});

describe("where a failed sign-in lands", () => {
  it("turns a status into a code a person can act on", () => {
    expect(errorForStatus(403)).toBe("no_account"); // the invite-first rule, seen from the login screen
    expect(errorForStatus(401)).toBe("expired");
    expect(errorForStatus(404)).toBe("unavailable");
    expect(errorForStatus(503)).toBe("unavailable");
    expect(errorForStatus(500)).toBe("failed");
    expect(errorForStatus(429)).toBe("failed");
  });

  it("tells 'I pressed cancel' apart from 'something broke'", () => {
    expect(errorForProviderResponse("access_denied")).toBe("cancelled");
    expect(errorForProviderResponse("consent_required")).toBe("cancelled");
    expect(errorForProviderResponse("server_error")).toBe("failed");
  });

  it("only renders codes it defined itself", () => {
    expect(isOidcError("no_account")).toBe(true);
    // the point of the allowlist: no upstream text ever reaches the page through the query string
    for (const bad of ["<script>alert(1)</script>", "Your account jane@evil.example is compromised", null, ""]) {
      expect(isOidcError(bad)).toBe(false);
    }
  });
});

describe("the redirect allowlist still governs where a provider sign-in returns to", () => {
  it("keeps a path inside /admin", () => {
    expect(safeNext("/admin/bogota#config")).toBe("/admin/bogota#config");
  });
  it("refuses to leave the site, whichever leg it comes from", () => {
    for (const evil of [
      "//accounts.google.com/admin",
      "https://evil.example/admin",
      "/\\evil.example",
      "/bogota",
      "/admin/login?next=/admin",
    ]) {
      expect(safeNext(evil)).toBe("/admin");
    }
  });
});

describe("cookies the flow sets", () => {
  it("keeps every one of them httpOnly and lax", () => {
    // lax rather than strict is load-bearing: the browser returns from the provider as a top-level
    // navigation from another site, and a strict cookie would not be sent with it.
    for (const o of [cookieOptions(OIDC_COOKIE_MAX_AGE), sessionCookie("t", undefined).options]) {
      expect(o.httpOnly).toBe(true);
      expect(o.sameSite).toBe("lax");
      expect(o.path).toBe("/");
    }
  });

  it("outlives the API's own state TTL, but only just", () => {
    expect(OIDC_COOKIE_MAX_AGE).toBeGreaterThan(600); // OIDC_STATE_TTL_SECONDS
    expect(OIDC_COOKIE_MAX_AGE).toBeLessThan(3600);
    expect(cookieOptions(0).maxAge).toBe(0); // how both flow cookies are cleared
  });

  it("names them apart from the session", () => {
    expect(new Set([OIDC_COOKIE, OIDC_NEXT_COOKIE, sessionCookie("t").name]).size).toBe(3);
  });

  it("carries the session expiry through unchanged", () => {
    const now = Date.parse("2026-09-08T12:00:00Z");
    expect(sessionCookie("t", "2026-09-08T20:00:00Z", now).options.maxAge).toBe(8 * 3600);
    expect(sessionCookie("t", undefined, now).value).toBe("t");
  });
});

describe("the session proxy and the provider endpoints stay apart", () => {
  it("lets the login screen read the provider list without a session", () => {
    expect(targetPath(["auth", "providers"])).toBe("/v1/admin/auth/providers");
  });

  it("never relays the provider sign-in endpoints", () => {
    // Relaying them would put the browser token — the thing that binds a flow to one browser — on the
    // page. The dedicated route handlers exist precisely so it stays in an httpOnly cookie.
    for (const bad of [
      ["auth", "oidc"],
      ["auth", "oidc", "google", "start"],
      ["auth", "oidc", "google", "callback"],
      ["auth", "oidc", "microsoft", "callback"],
    ]) {
      expect(targetPath(bad)).toBeNull();
    }
  });
});
