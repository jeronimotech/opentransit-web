"use client";

import { useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { ApiRequestError, MOCK } from "@/lib/api/client";
import { Button, Icon, Spinner, inputCls } from "@/components/ui/primitives";
import { AdminShell } from "./AdminShell";
import { useAdminSession } from "./useAdmin";

/** Renders the login card until `/v1/admin/me` accepts the token, then `children(session)`. */
export function TokenGate({ children }: { children: (s: { token: string; cities: string[]; logout: () => void }) => ReactNode }) {
  const { t } = useI18n();
  const s = useAdminSession();
  const [input, setInput] = useState("");

  if (!s.ready) return null;
  if (s.token && s.me.isSuccess) return <>{children({ token: s.token, cities: s.me.data.cities, logout: s.logout })}</>;

  const checking = !!s.token && s.me.isPending;
  const err = s.me.error;
  const message = !err ? null : err instanceof ApiRequestError && err.status === 401 ? t.admin.login.unauthorized : err instanceof ApiRequestError ? err.message : t.admin.login.unreachable;

  return (
    <AdminShell>
      <div className="mx-auto mt-10 max-w-md">
        <form
          className="rounded-card border border-line bg-paper-2 p-6 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) s.login(input.trim());
          }}
        >
          <h1 className="text-xl font-extrabold tracking-tight">{t.admin.login.title}</h1>
          <p className="mt-1 text-sm text-ink-2">{t.admin.login.hint}</p>
          <label htmlFor="admin-token" className="mt-5 block text-xs font-semibold text-ink-2">
            {t.admin.login.token}
          </label>
          <input
            id="admin-token"
            type="password"
            autoComplete="off"
            autoFocus
            className={`${inputCls} mt-1 font-mono`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-invalid={!!message}
            aria-describedby={message ? "admin-token-error" : undefined}
          />
          {message ? (
            <p id="admin-token-error" role="alert" className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-brick">
              <Icon.Alert width={16} height={16} /> {message}
            </p>
          ) : null}
          {MOCK ? <p className="mt-2 text-xs text-ink-3">{t.admin.login.demoHint}</p> : null}
          <Button type="submit" variant="primary" size="lg" className="mt-5 w-full" disabled={!input.trim() || checking}>
            {checking ? <Spinner className="border-t-signal-ink" /> : null}
            {checking ? t.admin.login.checking : t.admin.login.enter}
          </Button>
        </form>
      </div>
    </AdminShell>
  );
}
