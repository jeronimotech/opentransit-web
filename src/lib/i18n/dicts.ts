import type { Lang } from "../format";
import { dict, type Dict } from "./dict";
import { it } from "./dict.it";
import { pt } from "./dict.pt";
import { fr } from "./dict.fr";
import { ms } from "./dict.ms";
import { ar } from "./dict.ar";

/**
 * One dictionary per UI language. Spanish is the source of every key; the other six are
 * kept in step by dict-parity.test.ts (same keys, same nesting, same function arity), which
 * is why they can be cast here instead of retyping 1,100 literal strings per language.
 */
export const dicts: Record<Lang, Dict> = {
  es: dict.es,
  en: dict.en as unknown as Dict,
  it: it as unknown as Dict,
  pt: pt as unknown as Dict,
  fr: fr as unknown as Dict,
  ms: ms as unknown as Dict,
  ar: ar as unknown as Dict,
};
