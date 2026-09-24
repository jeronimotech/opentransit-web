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
    // A German speaker in Toronto gets English, not Spanish, because it is next in
    // their own list of preferences.
    expect(initialLang(null, ["de-DE", "en-CA"])).toBe("en");
    expect(initialLang(null, ["ja", "es-CO"])).toBe("es");
  });

  it("ends at Spanish when nothing else applies", () => {
    expect(initialLang(null, [])).toBe("es");
    expect(initialLang("de-DE", ["ja"])).toBe("es");
  });
});

// Seven languages now: a city that operates in one of them greets its visitors in it,
// and so does a browser that prefers it.
describe("the five languages added with the global cities", () => {
  it("follows the city's locale", () => {
    expect(initialLang("it-IT", ["en-US"])).toBe("it");
    expect(initialLang("pt-PT", ["en-US"])).toBe("pt");
    expect(initialLang("fr-MA", ["en-US"])).toBe("fr");
  });
  it("follows the browser when the city does not say", () => {
    expect(initialLang(null, ["ms-MY", "en"])).toBe("ms");
    expect(initialLang(null, ["ar", "fr"])).toBe("ar");
  });
});
