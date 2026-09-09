import { describe, expect, it } from "vitest";
import { initialLang } from "./provider";

// Spanish everywhere was right while Bogotá was the only city, and wrong the moment
// Toronto existed: an English city greeted its visitors in Spanish.
describe("the language to start in", () => {
  it("follows the city, which knows what language it operates in", () => {
    expect(initialLang("en-CA", ["es-CO"])).toBe("en");
    expect(initialLang("es-CO", ["en-US"])).toBe("es");
  });

  it("falls back to the browser when the city does not say", () => {
    expect(initialLang(null, ["en-GB", "fr"])).toBe("en");
    expect(initialLang(undefined, ["es-MX"])).toBe("es");
    expect(initialLang("", ["en"])).toBe("en");
  });

  it("skips languages we do not have and keeps looking", () => {
    // A French speaker in Toronto gets English, not Spanish, because it is next in
    // their own list of preferences.
    expect(initialLang(null, ["fr-CA", "en-CA"])).toBe("en");
    expect(initialLang(null, ["pt-BR", "es-CO"])).toBe("es");
  });

  it("ends at Spanish when nothing else applies", () => {
    expect(initialLang(null, [])).toBe("es");
    expect(initialLang("de-DE", ["ja"])).toBe("es");
  });
});
