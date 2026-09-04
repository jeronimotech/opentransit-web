"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/api/client";
import type { AdminConfigPatch, AdminConfigResponse } from "@/lib/api/types";
import { getToken, setToken } from "@/lib/admin/auth";

/** Token in sessionStorage + `/v1/admin/me` as the validity check. */
export function useAdminSession() {
  const qc = useQueryClient();
  const [token, setTok] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setTok(getToken());
    setReady(true);
  }, []);
  const me = useQuery({
    queryKey: ["admin", "me", token],
    queryFn: () => adminApi.me(token!),
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const login = useCallback((t: string) => {
    setToken(t);
    setTok(t);
  }, []);
  const logout = useCallback(() => {
    setToken(null);
    setTok(null);
    qc.removeQueries({ queryKey: ["admin"] });
  }, [qc]);
  return { token, ready, me, login, logout, authed: !!token && me.isSuccess };
}

export function useAdminConfig(token: string | null, city: string) {
  return useQuery({
    queryKey: ["admin", "config", city],
    queryFn: () => adminApi.config(token!, city),
    enabled: !!token && !!city,
    staleTime: 60_000,
  });
}

export function useAdminHistory(token: string | null, city: string, enabled = true) {
  return useQuery({
    queryKey: ["admin", "history", city],
    queryFn: () => adminApi.history(token!, city, 30),
    enabled: !!token && !!city && enabled,
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

export function useSaveConfig(token: string | null, city: string) {
  const after = useAfterChange(city);
  return useMutation({
    mutationFn: (patch: AdminConfigPatch) => adminApi.update(token!, city, patch),
    onSuccess: after,
  });
}

export function useResetAll(token: string | null, city: string) {
  const after = useAfterChange(city);
  return useMutation({
    mutationFn: () => adminApi.reset(token!, city),
    onSuccess: after,
  });
}
