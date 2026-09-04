export type Lang = "es" | "en";

const localeOf = (lang: Lang) => (lang === "es" ? "es-CO" : "en-US");

export function fmtTime(iso: string | null | undefined, tz: string, lang: Lang = "es"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(localeOf(lang), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(d);
}

export function fmtDateTime(iso: string, tz: string, lang: Lang = "es"): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(localeOf(lang), {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(d);
}

export function fmtDuration(seconds: number, lang: Lang = "es"): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return lang === "es" ? "<1 min" : "<1 min";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${m} min`;
  if (mm === 0) return `${h} h`;
  return `${h} h ${mm} min`;
}

export function fmtDistance(meters: number, lang: Lang = "es"): string {
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toLocaleString(localeOf(lang), { maximumFractionDigits: 1 })} km`;
}

export function fmtDelay(sec: number | null | undefined, lang: Lang = "es"): string | null {
  if (sec === null || sec === undefined) return null;
  const m = Math.round(sec / 60);
  if (Math.abs(m) < 1) return lang === "es" ? "a tiempo" : "on time";
  if (m > 0) return lang === "es" ? `+${m} min` : `+${m} min late`;
  return lang === "es" ? `${m} min` : `${m} min early`;
}

export function minutesUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
}

export function fmtMoney(amount: number, currency: string, lang: Lang = "es"): string {
  return new Intl.NumberFormat(localeOf(lang), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Local date/time input value (YYYY-MM-DDTHH:mm) for a given tz. */
export function toLocalInput(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** Offset in minutes of tz at given instant. */
export function tzOffsetMinutes(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** ISO string with the tz offset, e.g. 2026-09-04T08:15:00-05:00 */
export function toIsoWithOffset(date: Date, tz: string): string {
  const off = tzOffsetMinutes(date, tz);
  const sign = off >= 0 ? "+" : "-";
  const a = Math.abs(off);
  const hh = String(Math.floor(a / 60)).padStart(2, "0");
  const mm = String(a % 60).padStart(2, "0");
  const local = new Date(date.getTime() + off * 60000);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}` +
    `T${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:${p(local.getUTCSeconds())}${sign}${hh}:${mm}`
  );
}

/** Parse a YYYY-MM-DDTHH:mm local-in-tz value into an ISO string with offset. */
export function fromLocalInput(value: string, tz: string): string {
  const [d, t] = value.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  // First guess using the offset "now", then correct once for DST edges.
  const guess = new Date(Date.UTC(y, mo - 1, da, h, mi));
  const off1 = tzOffsetMinutes(guess, tz);
  const inst = new Date(guess.getTime() - off1 * 60000);
  const off2 = tzOffsetMinutes(inst, tz);
  const final = off1 === off2 ? inst : new Date(guess.getTime() - off2 * 60000);
  return toIsoWithOffset(final, tz);
}
