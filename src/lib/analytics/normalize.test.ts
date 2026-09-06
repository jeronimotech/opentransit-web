import { describe, expect, it } from "vitest";
import { normalizeFunnel, normalizeHours, normalizeOd, normalizePlaces, normalizeProviders, normalizeRoutes, normalizeSearches, normalizeSummary } from "./normalize";

// shapes captured from the live API (v1.5 first implementation) and from the contract
const liveSummary = {
  period: { from: "2026-08-30", to: "2026-09-06", days: 8 },
  totals: { sessions: 8, appOpens: 7, planRequests: 8, itinerarySelects: 7, goStarts: 0, goCompletions: 0, handoffs: 6, activeDays: 1 },
  previousTotals: { sessions: 0, planRequests: 0, itinerarySelects: 0, goStarts: 0, goCompletions: 0, handoffs: 0, activeDays: 0 },
  topModes: [{ mode_set: "TRANSIT+WALK", requests: 8, selects: 0 }],
  topRoutes: [{ route_id: "bogota:12873", views: 0, selects: 7, locates: 0, shortName: "G12" }],
};
const contractSummary = {
  range: { from: "a", to: "b" }, kThreshold: 5,
  kpis: { sessions: { value: 10, previous: 8 }, planRequests: { value: 5, previous: null }, itinerarySelects: { value: 1, previous: 1 }, goStarts: { value: 0, previous: 0 }, goCompletions: { value: 0, previous: 0 }, handoffs: { value: 2, previous: 1 }, activeDays: { value: 3, previous: 3 } },
  topModes: [{ modeSet: "BUS,WALK", requests: 4, selects: 2 }], topRoutes: [], topStops: [], platforms: [{ platform: "ios", sessions: 3 }], versions: [], lastRollupAt: null,
};

describe("analytics normalizers", () => {
  it("summary: live totals/previousTotals become kpis, snake_case lists map", () => {
    const s = normalizeSummary(liveSummary);
    expect(s.kpis.sessions).toEqual({ value: 8, previous: 0 });
    expect(s.kpis.handoffs.value).toBe(6);
    expect(s.range.from).toBe("2026-08-30");
    expect(s.topModes[0].modeSet).toBe("TRANSIT+WALK");
    expect(s.topRoutes[0]).toMatchObject({ routeId: "bogota:12873", shortName: "G12", selects: 7 });
    expect(s.kThreshold).toBe(5);
  });
  it("summary: contract shape passes through", () => {
    const s = normalizeSummary(contractSummary);
    expect(s.kpis.sessions).toEqual({ value: 10, previous: 8 });
    expect(s.kpis.planRequests.previous).toBeNull();
    expect(s.platforms[0].sessions).toBe(3);
  });
  it("summary: garbage never throws", () => {
    expect(() => normalizeSummary(null)).not.toThrow();
    expect(normalizeSummary("x").kpis.sessions.value).toBe(0);
  });
  it("lists: items/snake dialect and contract dialect", () => {
    expect(normalizeRoutes({ items: [{ route_id: "r", views: 1, selects: 2, locates: 3, shortName: "G" }] })[0].routeId).toBe("r");
    expect(normalizeSearches({ items: [{ result_type: "station", result_id: "s", label: "L", n: 7 }] }).searches[0].resultType).toBe("station");
    expect(normalizeProviders({ items: [{ provider_id: "taxi", handoffs: 6, had_estimate: 6 }] }).providers[0].hadEstimate).toBe(6);
    expect(normalizePlaces({ kind: "origin", items: [{ gh7: "x", center: { lat: 4.6, lon: -74 }, n: 8 }] }).places[0].center).toEqual([-74, 4.6]);
  });
  it("od: centers as objects or arrays", () => {
    const od = normalizeOd({ cells: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0]]] }, properties: { gh7: "g", origins: 8, destinations: 0, searches: 0 } }] }, pairs: [{ from_gh7: "a", to_gh7: "b", from_center: { lat: 1, lon: 2 }, to_center: [3, 4], n: 9 }] });
    expect(od.cells.features[0].properties.origins).toBe(8);
    expect(od.pairs[0].fromCenter).toEqual([2, 1]);
    expect(od.pairs[0].toCenter).toEqual([3, 4]);
  });
  it("funnel: snake days + totals; totals computed when missing", () => {
    const f = normalizeFunnel({ days: [{ day: "2026-09-06", app_opens: 7, sessions: 8, plan_requests: 8, itinerary_selects: 7, go_starts: 0, go_completions: 0 }] });
    expect(f.days[0].planRequests).toBe(8);
    expect(f.totals.sessions).toBe(8);
  });
  it("hours: matrix dialect becomes cells", () => {
    const m = Array.from({ length: 7 }, () => Array(24).fill(0));
    m[6][9] = 8;
    const h = normalizeHours({ weekdays: [], hours: [], planRequests: m });
    expect(h.cells).toHaveLength(168);
    expect(h.cells.find((c) => c.weekday === 6 && c.hour === 9)?.planRequests).toBe(8);
    expect(normalizeHours({ cells: [{ weekday: 0, hour: 1, planRequests: 2 }] }).cells[0].planRequests).toBe(2);
  });
});
