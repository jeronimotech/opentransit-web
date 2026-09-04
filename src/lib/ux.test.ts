import { describe, expect, it } from "vitest";
import { contrastRatio, desaturate, hexToRgb, isNeon, routeChipColors } from "./route-color";
import { cleanHeadsign } from "./text";
import { liveAutoOn, vehicleStyleForZoom } from "./marker-style";

describe("routeChipColors", () => {
  it("replaces neon feed colours with the component colour", () => {
    expect(routeChipColors("#FF0000", "#D32F2F").bg).toBe("#d32f2f");
    expect(routeChipColors("00FF00", "#2E7D4F").bg).toBe("#2e7d4f");
    expect(routeChipColors(null, "#1565C0").bg).toBe("#1565c0");
  });
  it("blends real feed colours 35 % toward the component colour", () => {
    const { bg } = routeChipColors("#8E24AA", "#1565C0");
    expect(bg).not.toBe("#8e24aa");
    expect(bg).not.toBe("#1565c0");
    const rgb = hexToRgb(bg)!;
    expect(rgb[2]).toBeGreaterThan(hexToRgb("#8E24AA")![2]); // moved toward blue
  });
  it("always reaches 4.5:1 contrast with its text", () => {
    for (const feed of ["#FFFF00", "#9CE0FF", "#F5CBA7", "#00FFFF", "#777777", "#D32F2F"]) {
      const { bg, fg } = routeChipColors(feed, "#F2B41B");
      expect(contrastRatio(hexToRgb(bg)!, hexToRgb(fg)!)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("detects neon", () => {
    expect(isNeon("#ff0000")).toBe(true);
    expect(isNeon("#d32f2f")).toBe(false);
    expect(isNeon("nope")).toBe(true);
  });
  it("desaturates without changing the hex format", () => {
    expect(desaturate("#ff0000", 0.2)).toMatch(/^#[0-9a-f]{6}$/);
    expect(desaturate("#ff0000", 0)).toBe("#ff0000");
  });
});

describe("cleanHeadsign", () => {
  it("renders A → B for feed separators", () => {
    expect(cleanHeadsign("Andalucía || Portal Norte")).toBe("Andalucía → Portal Norte");
    expect(cleanHeadsign("Nueva Roma ||  Portal Sur")).toBe("Nueva Roma → Portal Sur");
    expect(cleanHeadsign("Portal Norte - Portal Sur")).toBe("Portal Norte → Portal Sur");
    expect(cleanHeadsign("Portal Norte – Portal Sur")).toBe("Portal Norte → Portal Sur");
  });
  it("title-cases ALL-CAPS segments and keeps mixed case", () => {
    expect(cleanHeadsign("PORTAL SUR - CALLE 100")).toBe("Portal Sur → Calle 100");
    expect(cleanHeadsign("Br. Rafael Escamilla")).toBe("Br. Rafael Escamilla");
    expect(cleanHeadsign("AV. DE LA ESPERANZA")).toBe("Av. de la Esperanza");
  });
  it("drops empties and duplicates", () => {
    expect(cleanHeadsign("")).toBeNull();
    expect(cleanHeadsign(null)).toBeNull();
    expect(cleanHeadsign("Portal Sur || Portal Sur")).toBe("Portal Sur");
  });
});

describe("vehicleStyleForZoom", () => {
  it("hides the fleet at city zoom unless highlighted", () => {
    expect(vehicleStyleForZoom(12).visible).toBe(false);
    expect(vehicleStyleForZoom(12, true).visible).toBe(true);
    expect(liveAutoOn(13.9)).toBe(false);
    expect(liveAutoOn(14)).toBe(true);
  });
  it("uses small translucent dots at street zoom and ticks at detail zoom", () => {
    expect(vehicleStyleForZoom(15)).toEqual({ visible: true, radius: 3, opacity: 0.7, tick: false });
    expect(vehicleStyleForZoom(16.5)).toEqual({ visible: true, radius: 5, opacity: 1, tick: true });
  });
});
