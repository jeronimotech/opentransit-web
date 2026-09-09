"use client";

import { useEffect, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Icon, Spinner } from "@/components/ui/primitives";
import type { AdminUser } from "@/lib/admin/session";
import { AdminShell } from "./AdminShell";
import { isUnauthorized, useAdminSession, useSignInRedirect } from "./useAdmin";

export type AdminSessionView = { user: AdminUser; cities: string[]; canManageUsers: boolean; signOut: () => void };

/**
 * Nothing under /admin renders until the API has said who is signed in. An expired or revoked session
 * is not an error to show — it is a trip to the login screen, carrying where the operator was.
 */
export function AuthGate({ children }: { children: (s: AdminSessionView) => ReactNode }) {
  const { t } = useI18n();
  const { me, user, cities, canManageUsers, signOut } = useAdminSession();
  const toLogin = useSignInRedirect();
  const expired = me.isError && isUnauthorized(me.error);

  useEffect(() => {
    if (expired) toLogin();
  }, [expired, toLogin]);

  const bye = () => signOut.mutate(undefined, { onSettled: toLogin });

  if (user) return <>{children({ user, cities, canManageUsers, signOut: bye })}</>;
  return (
    <AdminShell>
      <div className="mx-auto mt-16 flex max-w-md items-center justify-center gap-2 text-sm text-ink-2">
        {me.isError && !expired ? (
          <span role="alert" className="flex items-center gap-1.5 font-semibold text-brick">
            <Icon.Alert width={16} height={16} /> {t.admin.login.unreachable}
          </span>
        ) : (
          <Spinner />
        )}
      </div>
    </AdminShell>
  );
}
