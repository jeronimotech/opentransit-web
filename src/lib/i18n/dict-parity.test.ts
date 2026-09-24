import { describe, expect, it } from "vitest";
import { dict } from "./dict";
import { dicts } from "./dicts";
import { landingCopy, copyFor } from "../landing-copy";
import { LANGS } from "../format";

type Any = Record<string, unknown>;

/** Every path where the two trees differ in keys, kind, or function arity. */
function diff(src: Any, other: Any, path = ""): string[] {
  const out: string[] = [];
  for (const k of Object.keys(src)) {
    const p = path + k;
    if (!(k in other)) {
      out.push(`missing ${p}`);
      continue;
    }
    const a = src[k];
    const b = other[k];
    if (typeof a !== typeof b) out.push(`kind ${p}: ${typeof a} vs ${typeof b}`);
    else if (typeof a === "function" && (a as () => void).length !== (b as () => void).length) out.push(`arity ${p}`);
    else if (Array.isArray(a) !== Array.isArray(b)) out.push(`array ${p}`);
    else if (a && typeof a === "object" && !Array.isArray(a)) out.push(...diff(a as Any, b as Any, p + "."));
  }
  for (const k of Object.keys(other)) if (!(k in src)) out.push(`extra ${path}${k}`);
  return out;
}

// Spanish is where every key is born; a language that lacks one would render "undefined"
// in the UI, and a language with an extra one is dead weight nobody can reach.
describe("every UI language has exactly the Spanish keys", () => {
  for (const { code } of LANGS) {
    it(code, () => {
      expect(diff(dict.es as unknown as Any, dicts[code] as unknown as Any)).toEqual([]);
    });
  }
});

describe("every landing copy has exactly the Spanish keys", () => {
  for (const { code } of LANGS) {
    it(code, () => {
      expect(diff(landingCopy.es as unknown as Any, copyFor(code) as unknown as Any)).toEqual([]);
    });
  }
  it("takes the language of a regional locale and falls back to English", () => {
    expect(copyFor("pt-PT").openApp).toBe(copyFor("pt").openApp);
    expect(copyFor("de-DE").openApp).toBe(landingCopy.en.openApp);
    expect(copyFor(null).openApp).toBe(landingCopy.es.openApp);
  });
});
