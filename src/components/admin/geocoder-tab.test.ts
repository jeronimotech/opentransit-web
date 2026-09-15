import { describe, expect, it } from "vitest";
import { aliasesText, parseAliases } from "./GeocoderTab";

describe("named-avenue aliases", () => {
  it("round-trips the textarea form", () => {
    const text = "avenida boyacá = AK 72\nautopista norte = AK 45";
    expect(parseAliases(text)).toEqual({ "avenida boyacá": "AK 72", "autopista norte": "AK 45" });
    expect(aliasesText(parseAliases(text)!)).toBe(text);
  });
  it("lower-cases the name, ignores blank lines and rejects a line without a code", () => {
    expect(parseAliases("Avenida Boyacá = AK 72\n\n")).toEqual({ "avenida boyacá": "AK 72" });
    expect(parseAliases("avenida boyacá")).toBeNull();
    expect(parseAliases("= AK 72")).toBeNull();
  });
});
