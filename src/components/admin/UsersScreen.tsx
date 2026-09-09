"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { fmtDateTime } from "@/lib/format";
import { ApiRequestError } from "@/lib/api/client";
import type { AdminUserRow } from "@/lib/api/types";
import { Badge, Button, EmptyState, Icon, Spinner, inputCls } from "@/components/ui/primitives";
import { ConfirmInline } from "./form";
import { useAdminUsers, useUserMutations } from "./useAdmin";

const ROLES = ["viewer", "admin", "owner"] as const;

function errorText(e: unknown): string {
  return e instanceof ApiRequestError ? e.message : e instanceof Error ? e.message : String(e ?? "");
}

/** Owner-only screen. The API refuses the same things again, so this is convenience, not the guard. */
export function UsersScreen({ cities, meId }: { cities: string[]; meId: number | null }) {
  const { t, lang } = useI18n();
  const q = useAdminUsers();
  const m = useUserMutations();
  const [adding, setAdding] = useState(false);

  if (q.isPending) return <Spinner />;
  if (q.isError) return <p role="alert" className="text-sm font-semibold text-brick">{errorText(q.error)}</p>;

  const users = q.data?.users ?? [];
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t.admin.users.title}</h1>
          <p className="mt-1 max-w-prose text-sm text-ink-2">{t.admin.users.hint}</p>
        </div>
        {!adding ? (
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Icon.User width={16} height={16} /> {t.admin.users.add}
          </Button>
        ) : null}
      </div>

      {adding ? (
        <UserForm
          cities={cities}
          submitting={m.create.isPending}
          error={m.create.error ? errorText(m.create.error) : null}
          onCancel={() => {
            m.create.reset();
            setAdding(false);
          }}
          onSubmit={(v) =>
            m.create.mutate(
              { email: v.email, password: v.password, name: v.name, role: v.role, cities: v.cities },
              { onSuccess: () => setAdding(false) },
            )
          }
        />
      ) : null}

      {users.length === 0 ? (
        <div className="mt-5">
          <EmptyState title={t.admin.users.empty} hint={t.admin.users.emptyHint} />
        </div>
      ) : (
        <ul className="mt-5 grid gap-3">
          {users.map((u) => (
            <UserRow key={u.id} user={u} cities={cities} isMe={u.id === meId} lang={lang} />
          ))}
        </ul>
      )}
    </>
  );
}

function UserRow({ user, cities, isMe, lang }: { user: AdminUserRow; cities: string[]; isMe: boolean; lang: "es" | "en" }) {
  const { t } = useI18n();
  const m = useUserMutations();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const scope = user.cities.length === 0 ? t.admin.users.allCities : user.cities.join(", ");
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;   // an account is not a city: show local time

  return (
    <li className="rounded-card border border-line bg-paper-2 p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold">
            <span className="truncate">{user.name || user.email}</span>
            <Badge tone={user.role === "owner" ? "info" : "neutral"}>{t.admin.users.roles[user.role]}</Badge>
            {user.disabled ? <Badge tone="bad">{t.admin.users.disabled}</Badge> : null}
            {isMe ? <Badge tone="ok">{t.admin.users.you}</Badge> : null}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-3">{user.email}</p>
          <p className="mt-1 text-xs text-ink-2">
            {t.admin.users.scope}: <strong>{scope}</strong>
            {user.lastLoginAt ? ` · ${t.admin.users.lastLogin} ${fmtDateTime(user.lastLoginAt, tz, lang)}` : ` · ${t.admin.users.neverSignedIn}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            {editing ? t.admin.discard : t.admin.users.edit}
          </Button>
          {!user.disabled ? (
            confirming ? (
              <ConfirmInline
                message={t.admin.users.disableConfirm}
                onConfirm={() => {
                  setConfirming(false);
                  m.disable.mutate(user.id);
                }}
                onCancel={() => setConfirming(false)}
              />
            ) : (
              <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
                {t.admin.users.disable}
              </Button>
            )
          ) : (
            <Button size="sm" variant="secondary" onClick={() => m.update.mutate({ id: user.id, patch: { disabled: false } })}>
              {t.admin.users.enable}
            </Button>
          )}
        </div>
      </div>
      {m.disable.error || m.update.error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-brick">{errorText(m.disable.error ?? m.update.error)}</p>
      ) : null}

      {editing ? (
        <UserForm
          cities={cities}
          existing={user}
          submitting={m.update.isPending}
          error={m.update.error ? errorText(m.update.error) : null}
          onCancel={() => {
            m.update.reset();
            setEditing(false);
          }}
          onSubmit={(v) =>
            m.update.mutate(
              {
                id: user.id,
                patch: { name: v.name, role: v.role, cities: v.cities, ...(v.password ? { password: v.password } : {}) },
              },
              { onSuccess: () => setEditing(false) },
            )
          }
        />
      ) : null}
    </li>
  );
}

type FormValue = { email: string; password: string; name: string; role: string; cities: string[] };

function UserForm({
  cities,
  existing,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  cities: string[];
  existing?: AdminUserRow;
  submitting: boolean;
  error: string | null;
  onSubmit: (v: FormValue) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [v, setV] = useState<FormValue>({
    email: existing?.email ?? "",
    password: "",
    name: existing?.name ?? "",
    role: existing?.role ?? "viewer",
    cities: existing?.cities ?? [],
  });
  const [allCities, setAllCities] = useState((existing?.cities ?? []).length === 0);
  const id = existing ? `u${existing.id}` : "new";

  return (
    <form
      className="mt-4 grid gap-4 rounded-card border border-line bg-paper p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...v, cities: allCities ? [] : v.cities });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">{t.admin.login.email}</span>
          <input
            id={`email-${id}`}
            type="email"
            required
            disabled={!!existing}
            autoComplete="off"
            className={`${inputCls} disabled:opacity-60`}
            value={v.email}
            onChange={(e) => setV({ ...v, email: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">{t.admin.users.name}</span>
          <input id={`name-${id}`} className={inputCls} maxLength={120} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">
            {existing ? t.admin.users.newPassword : t.admin.login.password}
          </span>
          <input
            id={`pw-${id}`}
            type="password"
            autoComplete="new-password"
            required={!existing}
            minLength={12}
            className={inputCls}
            value={v.password}
            onChange={(e) => setV({ ...v, password: e.target.value })}
          />
          <span className="mt-1 block text-xs text-ink-3">
            {existing ? t.admin.users.newPasswordHint : t.admin.users.passwordHint}
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">{t.admin.users.role}</span>
          <select id={`role-${id}`} className={inputCls} value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t.admin.users.roles[r]}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-ink-3">{t.admin.users.roleHint[v.role as (typeof ROLES)[number]]}</span>
        </label>
      </div>

      <fieldset>
        <legend className="mb-1 text-xs font-semibold text-ink-2">{t.admin.users.scope}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allCities} onChange={(e) => setAllCities(e.target.checked)} />
          {t.admin.users.allCities}
        </label>
        {!allCities ? (
          <div className="mt-2 flex flex-wrap gap-3">
            {cities.map((c) => (
              <label key={c} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={v.cities.includes(c)}
                  onChange={(e) => setV({ ...v, cities: e.target.checked ? [...v.cities, c] : v.cities.filter((x) => x !== c) })}
                />
                {c}
              </label>
            ))}
          </div>
        ) : null}
      </fieldset>

      {error ? <p role="alert" className="text-sm font-semibold text-brick">{error}</p> : null}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? <Spinner className="border-t-signal-ink" /> : <Icon.Check width={16} height={16} />}
          {existing ? t.admin.save : t.admin.users.create}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.admin.discard}
        </Button>
      </div>
    </form>
  );
}
