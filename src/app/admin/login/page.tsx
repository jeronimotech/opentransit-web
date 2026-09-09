"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { ApiRequestError, MOCK } from "@/lib/api/client";
import { Button, Icon, Spinner, inputCls } from "@/components/ui/primitives";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminSession, useLogin } from "@/components/admin/useAdmin";
import { safeNext } from "@/lib/admin/session";

export default function AdminLogin() {
  const { t } = useI18n();
  const router = useRouter();
  const login = useLogin();
  const { me } = useAdminSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Read `?next=` from the URL rather than useSearchParams: no Suspense boundary, same as the tab hash.
  const [next, setNext] = useState("/admin");
  useEffect(() => setNext(safeNext(new URLSearchParams(window.location.search).get("next"))), []);
  // Already signed in (a bookmarked /admin/login, or a second tab): don't ask again.
  useEffect(() => {
    if (me.isSuccess) router.replace(next);
  }, [me.isSuccess, next, router]);

  const err = login.error;
  const message = !err
    ? null
    : err instanceof ApiRequestError && err.status === 401
      ? t.admin.login.wrong
      : err instanceof ApiRequestError && err.status === 429
        ? t.admin.login.throttled
        : err instanceof ApiRequestError && err.status < 500
          ? err.message
          : t.admin.login.unreachable;

  return (
    <AdminShell>
      <div className="mx-auto mt-10 max-w-md">
        <form
          className="rounded-card border border-line bg-paper-2 p-6 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim() || !password) return;
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
      </div>
    </AdminShell>
  );
}
