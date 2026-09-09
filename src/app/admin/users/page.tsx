"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Icon } from "@/components/ui/primitives";
import { AdminShell } from "@/components/admin/AdminShell";
import { AuthGate } from "@/components/admin/AuthGate";
import { UsersScreen } from "@/components/admin/UsersScreen";

export default function AdminUsersPage() {
  const { t } = useI18n();
  return (
    <AuthGate>
      {({ user, cities, canManageUsers, signOut }) => (
        <AdminShell
          user={user}
          onSignOut={signOut}
          crumbs={
            <>
              <Link href="/admin" className="hover:text-ink">{t.admin.cities}</Link>
              <Icon.Chevron width={14} height={14} />
              <span className="font-semibold text-ink">{t.admin.users.title}</span>
            </>
          }
        >
          {canManageUsers ? (
            <UsersScreen cities={cities} meId={user.id} />
          ) : (
            <p className="text-sm font-semibold text-brick">{t.admin.users.ownerOnly}</p>
          )}
        </AdminShell>
      )}
    </AuthGate>
  );
}
