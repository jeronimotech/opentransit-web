"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { ApiRequestError, adminApi } from "@/lib/api/client";
import type { AdminConfigPatch, AdminConfigResponse, AdminMe, AdminUserPatch } from "@/lib/api/types";
import { hereAsNext } from "@/lib/admin/session";

const ME_KEY = ["admin", "me"] as const;

/**
 * Who is signed in. There is nothing to read locally — the session is an httpOnly cookie — so the
 * question is always asked of the server, and a 401 simply means "not signed in".
 */
export function useAdminSession() {
  const qc = useQueryClient();
  const me = useQuery<AdminMe>({
    queryKey: ME_KEY,
    queryFn: () => adminApi.me(),
    retry: false,
    staleTime: 5 * 60_000,
  });
  const signOut = useMutation({
    mutationFn: () => adminApi.logout(),
    onSettled: () => qc.removeQueries({ queryKey: ["admin"] }),
  });
  return {
    me,
    user: me.data?.user ?? null,
    cities: me.data?.cities ?? [],
    canManageUsers: !!me.data?.canManageUsers,
    signOut,
  };
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => adminApi.login(email, password),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

/**
 * A session dies on its own schedule, usually mid-edit. Sending the operator to /admin/login with
 * where they were attached means one sign-in puts them back on the same city and the same tab.
 */
export function useSignInRedirect() {
  const router = useRouter();
  return useCallback(() => {
    const next = typeof window === "undefined" ? "/admin" : hereAsNext(window.location);
    router.replace(`/admin/login?next=${encodeURIComponent(next)}`);
  }, [router]);
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 401;
}

export function useAdminConfig(city: string, enabled = true) {
  return useQuery({
    queryKey: ["admin", "config", city],
    queryFn: () => adminApi.config(city),
    enabled: enabled && !!city,
    retry: false,
    staleTime: 60_000,
  });
}

export function useAdminHistory(city: string, enabled = true) {
  return useQuery({
    queryKey: ["admin", "history", city],
    queryFn: () => adminApi.history(city, 30),
    enabled: !!city && enabled,
    retry: false,
    staleTime: 30_000,
  });
}

/** After a save the public city changes too: drop every cached view of it. */
function useAfterChange(city: string) {
  const qc = useQueryClient();
  return useCallback(
    (data: AdminConfigResponse | null) => {
      if (data) qc.setQueryData(["admin", "config", city], data);
      else qc.invalidateQueries({ queryKey: ["admin", "config", city] });
      qc.invalidateQueries({ queryKey: ["admin", "history", city] });
      qc.invalidateQueries({ queryKey: ["city", city] });
      qc.invalidateQueries({ queryKey: ["cities"] });
      qc.invalidateQueries({ queryKey: ["plan"] });
    },
    [qc, city],
  );
}

export function useSaveConfig(city: string) {
  const after = useAfterChange(city);
  return useMutation({
    mutationFn: (patch: AdminConfigPatch) => adminApi.update(city, patch),
    onSuccess: after,
  });
}

export function useResetAll(city: string) {
  const after = useAfterChange(city);
  return useMutation({
    mutationFn: () => adminApi.reset(city),
    onSuccess: after,
  });
}

/* ── Accounts (owner only) ────────────────────────────────────────────────── */

export function useAdminUsers(enabled = true) {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminApi.users(),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

export function useUserMutations() {
  const qc = useQueryClient();
  // Changing a role, a scope or a password revokes that person's sessions server-side, so the list is
  // the only thing that can still be stale here.
  const after = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });
  return {
    create: useMutation({ mutationFn: adminApi.createUser, onSuccess: after }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: number; patch: AdminUserPatch }) => adminApi.updateUser(id, patch),
      onSuccess: after,
    }),
    disable: useMutation({ mutationFn: (id: number) => adminApi.disableUser(id), onSuccess: after }),
  };
}
