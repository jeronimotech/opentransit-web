import type { RouteRef, ServiceWindow } from "./api/types";
import type { Dict } from "./i18n/dict";

/** "Fuera de horario · próximo 04:30" (TransMi App pattern) from `RouteRef.serviceWindow`. */
export function serviceStatus(t: Dict, r: Pick<RouteRef, "serviceWindow"> | null | undefined): { active: boolean | null; label: string | null } {
  const w: ServiceWindow | null | undefined = r?.serviceWindow;
  if (!w) return { active: null, label: null };
  if (w.active) return { active: true, label: t.route.inService(w.start, w.end) };
  return { active: false, label: t.route.outOfService(w.nextStart ?? w.start) };
}
