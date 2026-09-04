/**
 * Admin session: the operator token lives in sessionStorage only (never in the URL,
 * never in localStorage), so closing the tab forgets it. The editor's display name is
 * a convenience and may persist.
 */
const TOKEN_KEY = "opentransit.admin.token";
const EDITOR_KEY = "opentransit.admin.editor";

/** `NEXT_PUBLIC_ADMIN_ENABLED=0` (or `false`) hides /admin entirely (404). */
export const ADMIN_ENABLED = !["0", "false", "no"].includes(
  (process.env.NEXT_PUBLIC_ADMIN_ENABLED ?? "1").trim().toLowerCase(),
);

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}
export function getEditor(): string {
  try {
    return localStorage.getItem(EDITOR_KEY) ?? "";
  } catch {
    return "";
  }
}
export function setEditor(name: string) {
  try {
    localStorage.setItem(EDITOR_KEY, name);
  } catch {
    /* ignore */
  }
}
