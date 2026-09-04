/** ETA buckets for vehicle markers (TransMi App: 5 / 10 / 15 min). */
export type EtaBucket = "now" | "soon" | "later" | "far" | "none";

export function etaBucket(minutes: number | null | undefined): EtaBucket {
  if (minutes == null) return "none";
  if (minutes <= 5) return "now";
  if (minutes <= 10) return "soon";
  if (minutes <= 15) return "later";
  return "far";
}

export const ETA_COLORS: Record<EtaBucket, string> = {
  now: "#2e7d4f",
  soon: "#f2b41b",
  later: "#e8590c",
  far: "#7b8394",
  none: "",
};
