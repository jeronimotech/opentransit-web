"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { ApiRequestError, MOCK, adminApi } from "@/lib/api/client";
import { Button, Icon, Spinner, inputCls } from "@/components/ui/primitives";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminSession, useLogin } from "@/components/admin/useAdmin";
import { safeNext } from "@/lib/admin/session";
import { type OidcError, isOidcError } from "@/lib/admin/oidc";

/** Same shape as the secondary Button, but a real link: this navigation has to leave the app. */
const providerBtn =
  "inline-flex h-12 w-full items-center justify-center gap-2 select-none rounded-lg px-5 text-base font-semibold transition-colors bg-paper-3 text-ink hover:bg-line active:bg-line-2";

export default function AdminLogin() {
  const { t } = useI18n();
  const router = useRouter();
  const login = useLogin();
  const { me } = useAdminSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Read `?next=` from the URL rather than useSearchParams: no Suspense boundary, same as the tab hash.
  const [next, setNext] = useState("/admin");
  // A provider sign-in that failed comes back as a short code, never as text somebody else wrote.
  const [providerError, setProviderError] = useState<OidcError | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setNext(safeNext(q.get("next")));
    const err = q.get("error");
    setProviderError(isOidcError(err) ? err : null);
  }, []);
  // Already signed in (a bookmarked /admin/login, or a second tab): don't ask again.
  useEffect(() => {
    if (me.isSuccess) router.replace(next);
  }, [me.isSuccess, next, router]);

  // Which ways in this deployment offers. A provider without credentials is not in this list, so there
  // is no button for it — and its endpoints refuse anyway, which is the half that actually matters.
  const providers = useQuery({
    queryKey: ["admin", "providers"],
    queryFn: () => adminApi.providers(),
    retry: false,
    staleTime: 5 * 60_000,
    enabled: !MOCK,
  });

  const err = login.error;
  const message = providerError
    ? {
        no_account: t.admin.login.providerNoAccount,
        cancelled: t.admin.login.providerCancelled,
        expired: t.admin.login.providerExpired,
        unavailable: t.admin.login.providerUnavailable,
        failed: t.admin.login.providerFailed,
      }[providerError]
    : !err
      ? null
      : err instanceof ApiRequestError && err.status === 401
        ? t.admin.login.wrong
        : err instanceof ApiRequestError && err.status === 429
          ? t.admin.login.throttled
          : err instanceof ApiRequestError && err.status < 500
            ? err.message
            : t.admin.login.unreachable;

  const offered = providers.data?.providers ?? [];

  return (
    <AdminShell>
      <div className="mx-auto mt-10 max-w-md">
        <form
          className="rounded-card border border-line bg-paper-2 p-6 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim() || !password) return;
            setProviderError(null);
            login.mutate(
              { email: email.trim(), password },
              {
                onSuccess: () => {
                  setPassword("");
                  router.replace(next);
                },
              },
            );
          }}
        >
          <h1 className="text-xl font-extrabold tracking-tight">{t.admin.login.title}</h1>
          <p className="mt-1 text-sm text-ink-2">{t.admin.login.hint}</p>

          <label htmlFor="admin-email" className="mt-5 block text-xs font-semibold text-ink-2">
            {t.admin.login.email}
          </label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            autoFocus
            required
            className={`${inputCls} mt-1`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!message}
          />

          <label htmlFor="admin-password" className="mt-4 block text-xs font-semibold text-ink-2">
            {t.admin.login.password}
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            required
            className={`${inputCls} mt-1`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!message}
            aria-describedby={message ? "admin-login-error" : undefined}
          />

          {message ? (
            <p id="admin-login-error" role="alert" className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-brick">
              <Icon.Alert width={16} height={16} /> {message}
            </p>
          ) : null}
          {MOCK ? <p className="mt-2 text-xs text-ink-3">{t.admin.login.demoHint}</p> : null}

          <Button type="submit" variant="primary" size="lg" className="mt-5 w-full" disabled={login.isPending || !email.trim() || !password}>
            {login.isPending ? <Spinner className="border-t-signal-ink" /> : null}
            {login.isPending ? t.admin.login.checking : t.admin.login.enter}
          </Button>
          <p className="mt-4 text-xs text-ink-3">{t.admin.login.forgot}</p>
        </form>

        {offered.length > 0 ? (
          <div className="mt-5">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-ink-3">
              <span className="h-px flex-1 bg-line" />
              {t.admin.login.or}
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="mt-4 grid gap-2">
              {offered.map((p) => (
                // A plain anchor, not a Link: the route handler answers with a redirect off-site, which
                // a client-side navigation cannot follow.
                <a
                  key={p.id}
                  className={providerBtn}
                  href={`/api/admin/oidc/${encodeURIComponent(p.id)}/start?next=${encodeURIComponent(next)}`}
                  rel="nofollow"
                >
                  {t.admin.login.withProvider.replace("{provider}", p.label)}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
