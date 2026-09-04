/**
 * Headsign / route long-name cleanup (UX audit E). Feeds ship things like
 * `"Andalucía || Portal Norte"`, `"PORTAL SUR - CALLE 100"` or `"Nueva Roma ||  Portal Sur"`.
 * We render them as `A → B`, trimmed, with ALL-CAPS segments title-cased.
 */

const SEPARATORS = /\s*(?:\|\||\s-\s|–|—|->|→)\s*/;
const SMALL = new Set(["de", "del", "la", "las", "el", "los", "y", "a", "al", "en", "por", "con", "the", "of", "and"]);

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function isAllCaps(s: string): boolean {
  const letters = s.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

export function cleanHeadsign(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parts = raw
    .split(SEPARATORS)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((p) => (isAllCaps(p) ? titleCase(p) : p));
  if (!parts.length) return null;
  // drop consecutive duplicates ("Portal Sur || Portal Sur")
  const out: string[] = [];
  for (const p of parts) if (out[out.length - 1]?.toLowerCase() !== p.toLowerCase()) out.push(p);
  return out.join(" → ");
}
