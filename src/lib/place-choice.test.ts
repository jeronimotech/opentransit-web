import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyEndpoint,
  canSwap,
  coordName,
  isTransitResult,
  otherField,
  placeGlyph,
  pointFrom,
  replacesEndpoint,
  resultSubtitle,
  swapEndpoints,
  toPoint,
  type PlaceGlyph,
} from "./place-choice";
import { DEFAULT_MODES, toPlanParams, type PlannerPoint, type PlannerState } from "./planner-params";
import { dict } from "./i18n/dict";
import type { GeocodeResult } from "./api/types";

const base: PlannerState = {
  from: null,
  to: null,
  time: null,
  arriveBy: false,
  modes: DEFAULT_MODES,
  wheelchair: false,
  bike: false,
  rental: false,
  taxi: false,
  selected: null,
};

const PORTAL: PlannerPoint = { lat: 4.7546, lon: -74.0459, name: "Portal Norte" };
const CALLE85: PlannerPoint = { lat: 4.6818705, lon: -74.0749344, name: "Calle 85" };

/**
 * Rows copied from a live `GET /v1/cities/bogota/geocode` (API v2.1, 2026-09-07), not
 * from the mock: three bugs in this project came from fixtures with shapes the API never
 * sends. Note what the real payload does — a station carries no `component`, a Photon row
 * carries no `stopId`, and `label` is free text, not a fixed vocabulary.
 */
const LIVE: GeocodeResult[] = [
  { id: "stop:bogota:57299", name: "Centro Empresarial Calle 100", label: "Parada · 212B00_TM · dual", lat: 4.68583715048238, lon: -74.05307779709356, type: "stop", stopId: "bogota:57299", component: "dual", source: "gtfs", distanceMeters: 733 },
  { id: "stop:bogota:2300", name: "Calle 100 - Marketmedios", label: "Estación", lat: 4.68450050423631, lon: -74.05766576971416, type: "station", stopId: null, component: null, source: "gtfs", distanceMeters: 986 },
  { id: "photon:W403472299", name: "Calle 100", label: "Localidad Usaquén, Bogotá", lat: 4.6870188, lon: -74.0553675, type: "street", stopId: null, component: null, source: "photon", distanceMeters: 981 },
  { id: "photon:W1489591400", name: "Portal de Burgos", label: "Localidad Engativá, Bogotá", lat: 4.6951366, lon: -74.0999871, type: "place", stopId: null, component: null, source: "photon", distanceMeters: null },
  { id: "photon:N1", name: "Calle 26 # 13-19", label: null, lat: 4.6122, lon: -74.0712, type: "address", stopId: null, component: null, source: "photon" },
];

describe("swapping the two ends", () => {
  it("survives one field being empty", () => {
    expect(canSwap({ from: PORTAL, to: null })).toBe(true);
    expect(canSwap({ from: null, to: CALLE85 })).toBe(true);
    expect(canSwap({ from: null, to: null })).toBe(false);

    const half = swapEndpoints({ ...base, from: PORTAL, to: null });
    expect(half.from).toBeNull();
    expect(half.to).toEqual(PORTAL);
  });

  it("exchanges both ends and drops the chosen itinerary", () => {
    const s = swapEndpoints({ ...base, from: PORTAL, to: CALLE85, selected: 2 });
    expect(s.from).toEqual(CALLE85);
    expect(s.to).toEqual(PORTAL);
    expect(s.selected).toBeNull();
  });
});

describe("filling a field", () => {
  it("plans only once both ends are set", () => {
    const first = applyEndpoint(base, "to", CALLE85);
    expect(first.ready).toBe(false);
    expect(first.next.to).toEqual(CALLE85);
    expect(first.next.from).toBeNull();

    const second = applyEndpoint(first.next, "from", PORTAL);
    expect(second.ready).toBe(true);
    expect(toPlanParams(second.next, "es")).toMatchObject({ fromName: "Portal Norte", toName: "Calle 85" });
  });

  it("fills either field from the same result", () => {
    const asOrigin = applyEndpoint(base, "from", toPoint(LIVE[2]));
    const asDestination = applyEndpoint(base, "to", toPoint(LIVE[2]));
    expect(asOrigin.next.from?.name).toBe("Calle 100");
    expect(asDestination.next.to?.name).toBe("Calle 100");
  });

  it("says when a field already holds something, so nothing is replaced silently", () => {
    const s = { ...base, from: PORTAL };
    expect(replacesEndpoint(s, "from")).toBe(true);
    expect(replacesEndpoint(s, "to")).toBe(false);
    expect(otherField("from")).toBe("to");
    expect(otherField("to")).toBe("from");
  });

  it("drops the selected itinerary, because the trip changed", () => {
    expect(applyEndpoint({ ...base, from: PORTAL, to: CALLE85, selected: 1 }, "to", PORTAL).next.selected).toBeNull();
  });
});

describe("naming a point chosen on the map", () => {
  it("uses the reverse-geocoded name when there is one", () => {
    expect(pointFrom(4.6818705, -74.0749344, "Calle 85")).toEqual({ lat: 4.6818705, lon: -74.0749344, name: "Calle 85" });
  });

  it("falls back to coordinates when the geocoder says nothing", () => {
    expect(pointFrom(4.6818705, -74.0749344).name).toBe("4.68187, -74.07493");
    expect(pointFrom(4.6818705, -74.0749344, "").name).toBe("4.68187, -74.07493");
    expect(pointFrom(4.6818705, -74.0749344, "   ").name).toBe("4.68187, -74.07493");
    expect(pointFrom(4.6818705, -74.0749344, null).name).toBe("4.68187, -74.07493");
    expect(coordName(-0.5, 30)).toBe("-0.50000, 30.00000");
  });

  it("keeps a nameless point usable as an endpoint", () => {
    const nameless = pointFrom(4.61, -74.07);
    const { next, ready } = applyEndpoint({ ...base, from: PORTAL }, "to", nameless);
    expect(ready).toBe(true);
    expect(toPlanParams(next, "es")).toMatchObject({ toLat: 4.61, toLon: -74.07, toName: "4.61000, -74.07000" });
  });
});

describe("telling a stop from a street", () => {
  it("maps every live row to its own glyph", () => {
    expect(LIVE.map(placeGlyph)).toEqual(["stop", "station", "street", "place", "address"]);
  });

  it("treats only GTFS stops and stations as transit", () => {
    expect(LIVE.map(isTransitResult)).toEqual([true, true, false, false, false]);
  });

  it("shows the API's own label, and names the kind when there is none", () => {
    const labels = Object.fromEntries(
      (["station", "stop", "address", "street", "poi", "place"] as PlaceGlyph[]).map((k) => [k, dict.es.common[k]]),
    ) as Record<PlaceGlyph, string>;
    expect(resultSubtitle(LIVE[0], labels)).toBe("Parada · 212B00_TM · dual");
    expect(resultSubtitle(LIVE[2], labels)).toBe("Localidad Usaquén, Bogotá");
    expect(resultSubtitle(LIVE[4], labels)).toBe("Dirección"); // label: null in the payload
  });
});

/* ── es/en for every new string ───────────────────────────────────────────── */

describe("i18n", () => {
  const NEW_KEYS = [
    "setAsOrigin",
    "setAsDestination",
    "replaceOrigin",
    "replaceDestination",
    "pickOrigin",
    "pickDestination",
    "pickDragHint",
    "pickResolving",
    "pickUnnamed",
    "pickConfirm",
    "cancel",
    "dragPins",
    "pinFrom",
    "pinTo",
  ] as const;

  it("has both languages for every string v2.1 added", () => {
    for (const k of NEW_KEYS) {
      expect(dict.es.planner[k], `es.planner.${k}`).toBeTruthy();
      expect(dict.en.planner[k], `en.planner.${k}`).toBeTruthy();
      expect(dict.es.planner[k]).not.toEqual(dict.en.planner[k]);
    }
    expect(dict.es.common.place).toBeTruthy();
    expect(dict.en.common.place).toBeTruthy();
  });

  it("names what a result would replace", () => {
    expect(dict.es.planner.replaceOrigin("Portal Norte")).toContain("Portal Norte");
    expect(dict.en.planner.replaceDestination("Portal Norte")).toContain("Portal Norte");
  });
});

/* ── the API contract, compared with the API's own source when it is next door ── */

/** Every `type` a geocode result can carry (opentransit-api, 2026-09-07). */
const API_PLACE_TYPES = ["address", "place", "poi", "station", "stop", "street"];
const apiFile = (...parts: string[]) => join(process.cwd(), "..", "opentransit-api", ...parts);
const MODELS_PY = apiFile("app", "models.py");
const GEOCODE_ROUTER_PY = apiFile("app", "routers", "geocode.py");
/** The neighbouring repo is a bonus, not a requirement: CI checks out this one alone. */
const hasApiRepo = existsSync(MODELS_PY) && existsSync(GEOCODE_ROUTER_PY);
const DRIFT = "the geocode contract moved: update the pinned list in this file (and whatever consumes it)";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("geocode contract", () => {
  it("the type union lists every type the API can return", () => {
    const types = read("src", "lib", "api", "types.ts");
    const union = types.slice(types.indexOf("export type GeocodeResult ="), types.indexOf("export type GeocodeResponse ="));
    expect(API_PLACE_TYPES.filter((k) => !union.includes(`"${k}"`))).toEqual([]);
    // the API declares both of these optional; a required `label` was a lie
    expect(union).toContain("label: string | null");
    expect(union).toContain("distanceMeters?: number | null");
  });

  it("every type has a glyph and a name in both languages", () => {
    for (const t of API_PLACE_TYPES) {
      expect(placeGlyph({ type: t as GeocodeResult["type"], stopId: null })).toBe(t);
      expect(dict.es.common[t as PlaceGlyph]).toBeTruthy();
      expect(dict.en.common[t as PlaceGlyph]).toBeTruthy();
    }
  });

  it.skipIf(!hasApiRepo)("the pinned list still matches the API's own model", () => {
    const src = readFileSync(MODELS_PY, "utf8");
    const block = src.slice(src.indexOf("class GeocodeResult"), src.indexOf("class GeocodeResponse"));
    const literal = /type:\s*Literal\[([^\]]+)\]/.exec(block);
    expect(literal, "GeocodeResult.type is no longer a Literal").toBeTruthy();
    const emitted = [...literal![1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]).sort();
    expect(emitted, DRIFT).toEqual([...API_PLACE_TYPES].sort());
    expect(block, DRIFT).toContain("label: str | None");
    expect(block, DRIFT).toContain("distance_meters: int | None");
  });

  it.skipIf(!hasApiRepo)("the reverse endpoint the picker calls is the one the API serves", () => {
    expect(readFileSync(GEOCODE_ROUTER_PY, "utf8")).toContain('"/v1/cities/{city}/reverse"');
    expect(read("src", "lib", "api", "client.ts")).toMatch(/reverse:\s*\(city: string, lat: number, lon: number\)/);
  });

  it("the mock only emits shapes the API can produce", () => {
    const mock = read("src", "mocks", "handlers.ts");
    const emitted = [...new Set([...mock.matchAll(/type:\s*"(station|stop|address|poi|street|place)"/g)].map((m) => m[1]))];
    expect(emitted.filter((k) => !API_PLACE_TYPES.includes(k))).toEqual([]);
    // a demo that cannot produce a street cannot show that a street is not a station
    expect(emitted).toContain("street");
    expect(emitted).toContain("place");
    expect(mock).toMatch(/source:\s*"photon"/);
  });
});

/* ── the wiring the addendum asks for, pinned where it is easy to undo by accident ── */

describe("planner wiring", () => {
  it("offers both fields on every result, and a map pick and a position for each", () => {
    const input = read("src", "components", "planner", "PlaceInput.tsx");
    expect(input).toContain("geocode-use-as-");
    expect(input).toMatch(/pick\(r, away, i\)/);
    const form = read("src", "components", "planner", "PlannerForm.tsx");
    for (const kind of ["from", "to"]) {
      expect(form, `${kind} must offer "choose on map"`).toContain(`onPickOnMap={() => onPickOnMap("${kind}")}`);
      expect(form, `${kind} must offer "my location"`).toContain(`onUseLocation={() => onUseLocation("${kind}")}`);
    }
    expect(form).toContain("disabled={!canSwap(state)}");
  });

  it("keeps the picker's confirm reachable when the point has no name", () => {
    const picker = read("src", "components", "planner", "MapPicker.tsx");
    expect(picker).toContain("pointFrom(centre.lat, centre.lon, name)");
    expect(picker).not.toMatch(/disabled=\{[^}]*name/); // confirming a nameless point is allowed
    expect(picker).toContain("coordName(centre.lat, centre.lon)");
  });

  it("lets a long press on the main map start or end a trip there", () => {
    const page = read("src", "app", "[city]", "page.tsx");
    expect(page).toContain("<LongPressPick onPick={onDropPin} />");
    const press = read("src", "components", "planner", "LongPressPick.tsx");
    // Both ends, not just the destination.
    expect(press).toContain('choose("from")');
    expect(press).toContain('choose("to")');
    // A press that becomes a pan must not steal the gesture.
    expect(press).toMatch(/Math\.hypot\(dx, dy\) > SLOP_PX/);
    expect(press).toContain('map.on("dragstart", clear)');
    expect(press).toContain('map.on("zoomstart", clear)');
    // Every listener it adds is removed again; a leaked map handler survives the page.
    const added = [...press.matchAll(/addEventListener\("(\w+)"/g)].map((m) => m[1]);
    const removed = [...press.matchAll(/removeEventListener\("(\w+)"/g)].map((m) => m[1]);
    expect(new Set(added)).toEqual(new Set(removed));
  });

  it("keeps the trip pins and the walking legs visible in either theme", () => {
    const layers = read("src", "components", "map", "layers.tsx");
    // Both were painted with the light palette's ink and disappeared into the dark
    // basemap: a pin you place and drag, and the walk legs that open and close a
    // multimodal trip, are exactly what a rider must be able to see.
    expect(layers).toContain('kind === "from" ? "var(--ink)" : "var(--signal)"');
    expect(layers).toContain('"line-color": walkColor');
    expect(layers).toMatch(/themeColor\("--ink"/);
  });

  it("swaps the basemap when the theme changes", () => {
    const view = read("src", "components", "map", "MapView.tsx");
    // The style JSON we load carries no `name`, so reading it back always looked "light":
    // switching to light never swapped the basemap and dark re-fetched itself.
    expect(view, "must not sniff the style's name").not.toMatch(/getStyle\(\)[\s\S]{0,80}name/);
    expect(view).toContain("appliedDark");
    expect(view).toMatch(/if \(wantDark === appliedDark\.current\) return;/);
  });

  it("drags the trip's two ends and re-plans on drop", () => {
    const page = read("src", "app", "[city]", "page.tsx");
    expect(page).toContain('onDropPin("from", p)');
    expect(page).toContain('onDropPin("to", p)');
    expect(page).toMatch(/applyPlace\(field, pointFrom\(p\.lat, p\.lon\)\)/);
  });
});
