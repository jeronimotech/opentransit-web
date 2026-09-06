import { describe, expect, it } from "vitest";
import { dict } from "@/lib/i18n/dict";

describe("admin analytics copy", () => {
  it("renders the k-anonymity note with the threshold in both languages", () => {
    expect(dict.es.admin.analytics.map.kNote(5)).toContain("5");
    expect(dict.en.admin.analytics.map.kNote(5)).toMatch(/5 or more/);
    expect(dict.es.admin.tabs.analytics).toBe("Analítica");
  });
});
