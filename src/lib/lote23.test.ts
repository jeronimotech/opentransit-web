import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { alertsOnItinerary, autoDirection, flipDirection, hourInTz, resolveCommute } from "./commute";
import { GAP_THRESHOLD_SECONDS, gapAfter, noteAt, recommendedIndex, toRows } from "./forecast";
import { goQuickLinks, placeVehicles } from "./line-timeline";
import { isLive, minutesLeft, progressAgeSeconds, shareView } from "./share";
import type { Alert, ForecastOption, ForecastResponse, Itinerary, Leg, SharedEta, Stop, Vehicle } from "./api/types";
import type { FavPlace } from "./favorites";

const TZ = "America/Bogota";
const place = (kind: FavPlace["placeKind"], name: string): FavPlace => ({ kind: "place", id: kind, placeKind: kind, name, lat: 4.6, lon: -74.1 });
const home = place("home", "Casa");
const work = place("work", "Trabajo");

/* ── Casa ⇄ Trabajo ─────────────────────────────────────────────────────── */

describe("commute direction", () => {
  // 08:00 and 19:00 in Bogotá, expressed as UTC instants
  const morning = Date.parse("2026-09-07T13:00:00Z");
  const evening = Date.parse("2026-09-08T00:00:00Z");

  it("reads the hour in the city's timezone, not the browser's", () => {
    expect(hourInTz(morning, TZ)).toBe(8);
    expect(hourInTz(evening, TZ)).toBe(19);
  });

  it("points at work in the morning and home in the evening", () => {
    expect(autoDirection(home, work, morning, TZ)).toBe("toWork");
    expect(autoDirection(home, work, evening, TZ)).toBe("toHome");
  });

  it("points at whichever place exists when only one is saved", () => {
    expect(autoDirection(home, undefined, evening, TZ)).toBe("toHome");
    expect(autoDirection(undefined, work, evening, TZ)).toBe("toWork");
    expect(autoDirection(undefined, undefined, evening, TZ)).toBeNull();
  });

  it("resolves a trip between both places and inverts on demand", () => {
    const a = resolveCommute(home, work, "toWork")!;
    expect(a.origin?.id).toBe("home");
    expect(a.destination.id).toBe("work");
    const b = resolveCommute(home, work, flipDirection("toWork"))!;
    expect(b.destination.id).toBe("home");
  });

  it("starts from the device when only the destination is saved", () => {
    const r = resolveCommute(undefined, work, "toWork")!;
    expect(r.origin).toBeNull();
    expect(r.destination.id).toBe("work");
  });

  it("falls back to the saved place when asked for a direction it cannot serve", () => {
    const r = resolveCommute(undefined, work, "toHome")!;
    expect(r.direction).toBe("toWork");
  });
});

describe("alerts on the commute", () => {
  const alert = (id: string, routeIds: string[]): Alert => ({ id, cause: null, effect: "DETOUR", severity: "WARNING", header: `h${id}`, description: null, url: null, start: null, end: null, routeIds, stopIds: [], routes: [] });
  const it0 = { legs: [{ route: { id: "bogota:R1" } }, { route: null }] } as unknown as Itinerary;

  it("matches only the routes actually used, without duplicates", () => {
    const hits = alertsOnItinerary(it0, [alert("a", ["bogota:R1"]), alert("a", ["bogota:R1"]), alert("b", ["bogota:R9"])]);
    expect(hits.map((h) => h.id)).toEqual(["a"]);
  });

  it("is empty without an itinerary or alerts", () => {
    expect(alertsOnItinerary(null, [alert("a", ["bogota:R1"])])).toEqual([]);
    expect(alertsOnItinerary(it0, [])).toEqual([]);
  });
});

/* ── "Cuándo salir" ─────────────────────────────────────────────────────── */

const T0 = Date.parse("2026-09-07T13:00:00Z");
const opt = (departMin: number, arriveMin: number, over: Partial<ForecastOption> = {}): ForecastOption => ({
  departAt: new Date(T0 + departMin * 60_000).toISOString(),
  arriveAt: new Date(T0 + arriveMin * 60_000).toISOString(),
  durationSeconds: (arriveMin - departMin) * 60,
  transfers: 0,
  walkMeters: 400,
  modesUsed: ["WALK", "BUS"],
  routeIds: ["bogota:R1"],
  fare: null,
  realtime: false,
  recommended: false,
  gapAfterSeconds: null,
  ...over,
});

describe("forecast rows", () => {
  it("orders by departure and flags only gaps over the threshold", () => {
    const res = { options: [opt(40, 85), opt(5, 50), opt(12, 60)], notes: [] } as unknown as ForecastResponse;
    const rows = toRows(res);
    expect(rows.map((r) => r.option.departAt)).toEqual([opt(5, 50).departAt, opt(12, 60).departAt, opt(40, 85).departAt]);
    expect(rows[0].gapAfterSeconds).toBeNull(); // 7 min, under the threshold
    expect(rows[1].gapAfterSeconds).toBe(28 * 60); // 28 min ≥ threshold → called out
    expect(rows[2].gapAfterSeconds).toBeNull(); // nothing after
  });

  it("derives the gap when the API omits it, and trusts it when sent", () => {
    const options = [opt(0, 40), opt(45, 85)];
    expect(gapAfter(options, 0)).toBe(45 * 60);
    const withField = [opt(0, 40, { gapAfterSeconds: 10 * 60 }), opt(45, 85)];
    expect(gapAfter(withField, 0)).toBeNull(); // the API says 10 min → under the threshold
    expect(GAP_THRESHOLD_SECONDS).toBe(1200);
  });

  it("marks the last row as last service only when the API says so", () => {
    const withNote = toRows({ options: [opt(5, 50), opt(12, 60)], notes: [{ kind: "last_service", at: null, text: "x" }] } as unknown as ForecastResponse);
    expect(withNote.map((r) => r.lastService)).toEqual([false, true]);
    const without = toRows({ options: [opt(5, 50)], notes: [] } as unknown as ForecastResponse);
    expect(without[0].lastService).toBe(false);
  });

  it("prefers the API's recommendation and otherwise picks the earliest arrival", () => {
    const flagged = toRows({ options: [opt(5, 90), opt(12, 60, { recommended: true })], notes: [] } as unknown as ForecastResponse);
    expect(recommendedIndex(flagged)).toBe(1);
    const derived = toRows({ options: [opt(5, 90), opt(12, 60)], notes: [] } as unknown as ForecastResponse);
    expect(recommendedIndex(derived)).toBe(1);
    expect(recommendedIndex([])).toBe(-1);
  });

  it("accepts either spelling of the note timestamp", () => {
    expect(noteAt({ kind: "long_gap", at: "A", text: "" })).toBe("A");
    expect(noteAt({ kind: "long_gap", atrs: "B", text: "" })).toBe("B");
    expect(noteAt({ kind: "long_gap", text: "" })).toBeNull();
  });

  it("survives an empty or missing response", () => {
    expect(toRows(undefined)).toEqual([]);
    expect(toRows({ options: [], notes: [] } as unknown as ForecastResponse)).toEqual([]);
  });
});

/* ── Line page timeline ─────────────────────────────────────────────────── */

const stop = (id: string, lat: number, lon: number): Stop => ({ id, code: null, name: id, lat, lon, locationType: "stop", component: "trunk", wheelchair: "unknown", parentStationId: null } as unknown as Stop);
const veh = (id: string, over: Partial<Vehicle> = {}): Vehicle => ({ id, label: null, routeId: "bogota:R1", routeShortName: "R1", tripId: null, tripResolved: true, component: "trunk", lat: 0, lon: 0, bearing: null, timestamp: "", stopId: null, stopSequence: null, occupancy: null, ...over });

describe("vehicles on the stop timeline", () => {
  const stops = [stop("s0", 4.60, -74.10), stop("s1", 4.61, -74.10), stop("s2", 4.62, -74.10)];

  it("places a bus at the stop it is heading to", () => {
    const map = placeVehicles(stops, [veh("v1", { stopId: "s1" })]);
    expect(map.get(1)?.map((v) => v.id)).toEqual(["v1"]);
    expect(map.has(0)).toBe(false);
  });

  it("snaps a bus with no stop id to the nearest stop", () => {
    const map = placeVehicles(stops, [veh("v2", { lat: 4.6201, lon: -74.1 })]);
    expect(map.get(2)?.map((v) => v.id)).toEqual(["v2"]);
  });

  it("drops a bus that is too far to place honestly", () => {
    const map = placeVehicles(stops, [veh("v3", { lat: 4.80, lon: -74.5 })]);
    expect(map.size).toBe(0);
  });

  it("groups several buses on the same segment", () => {
    const map = placeVehicles(stops, [veh("a", { stopId: "s2" }), veh("b", { stopId: "s2" })]);
    expect(map.get(2)).toHaveLength(2);
  });

  it("builds a GO deep link with a web fallback", () => {
    const l = goQuickLinks("bogota", "bogota:2000", "bogota:R1", "https://x.test");
    expect(l.app).toBe("opentransit://bogota/next?stop=bogota%3A2000&route=bogota%3AR1&go=1");
    expect(l.web).toBe("https://x.test/bogota/next?stop=bogota%3A2000&route=bogota%3AR1&go=1");
  });
});

/* ── Shared ETA states ──────────────────────────────────────────────────── */

const shared = (over: Partial<SharedEta> = {}): SharedEta => ({
  label: "A → B",
  itinerary: { endTime: new Date(T0 + 20 * 60_000).toISOString(), legs: [] as Leg[] } as unknown as Itinerary,
  progress: null,
  updatedAt: new Date(T0 - 30_000).toISOString(),
  expiresAt: new Date(T0 + 120 * 60_000).toISOString(),
  city: { id: "bogota", name: "Bogotá", timezone: TZ },
  ...over,
});

describe("shared ETA view state", () => {
  it("is expired without data or past the expiry", () => {
    expect(shareView(null, T0)).toBe("expired");
    expect(shareView(shared({ expiresAt: new Date(T0 - 1000).toISOString() }), T0)).toBe("expired");
  });

  it("maps progress to the four live states", () => {
    expect(shareView(shared(), T0)).toBe("on_time");
    expect(shareView(shared({ progress: { legIndex: 0, etaAt: "", state: "delayed" } }), T0)).toBe("delayed");
    expect(shareView(shared({ progress: { legIndex: 0, etaAt: "", state: "arrived" } }), T0)).toBe("arrived");
    expect(shareView(shared({ progress: { legIndex: 0, etaAt: "", state: "cancelled" } }), T0)).toBe("ended");
  });

  it("only keeps polling while the trip is moving", () => {
    expect(isLive("on_time")).toBe(true);
    expect(isLive("delayed")).toBe(true);
    expect(isLive("arrived")).toBe(false);
    expect(isLive("expired")).toBe(false);
  });

  it("prefers the live ETA over the planned one", () => {
    expect(minutesLeft(shared(), T0)).toBe(20);
    expect(minutesLeft(shared({ progress: { legIndex: 0, etaAt: new Date(T0 + 5 * 60_000).toISOString(), state: "delayed" } }), T0)).toBe(5);
    expect(minutesLeft(null, T0)).toBeNull();
  });

  it("reports how stale the shared position is", () => {
    expect(progressAgeSeconds(shared(), T0)).toBe(30);
    expect(progressAgeSeconds(null, T0)).toBeNull();
  });
});

/* ── the link a person actually receives ───────────────────────────────────── */

describe("shared trip link", () => {
  const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

  it("the share page lives where the API sends people", () => {
    // The API builds `<web>/{city}/eta/{token}`. If this route moves, every link
    // already in someone's chat breaks, and the API has no way to know.
    expect(existsSync(join(process.cwd(), "src", "app", "(share)", "[city]", "eta", "[token]", "page.tsx"))).toBe(true);
    const mock = read("src", "mocks", "share.ts");
    expect(mock).toContain("/${city}/eta/${t}");
  });

  it("the shared page is not indexed and does not repeat its own name", () => {
    const page = read("src", "app", "(share)", "[city]", "eta", "[token]", "page.tsx");
    // A shared trip is private: no destination in the title, no search engine.
    expect(page).toContain("index: false");
    // `absolute` escapes the root template, which produced "opentransit · opentransit".
    expect(page).toContain('title: { absolute: "opentransit" }');
  });
});

describe("deep-link verification files", () => {
  const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
  const routes = [
    ["apple-app-site-association", "APPLE_TEAM_ID"],
    ["assetlinks.json", "ANDROID_PACKAGE_NAME"],
  ] as const;

  it.each(routes)("%s is evaluated per request, not baked at build", (dir, envVar) => {
    const src = read("src", "app", ".well-known", dir, "route.ts");
    // Only NEXT_PUBLIC_* reach the Docker build as args. A statically evaluated route
    // read these as empty at build time and then served 404 for the life of the image,
    // with nothing to indicate the deep links were dead.
    expect(src).toContain('export const dynamic = "force-dynamic"');
    expect(src).not.toContain("force-static");
    // ...and the value must be read inside the handler, not at module scope.
    const handlerAt = src.indexOf("export function GET");
    expect(src.indexOf(`process.env.${envVar}`)).toBeGreaterThan(handlerAt);
  });

  it.each(routes)("%s refuses to guess when it is unconfigured", (dir) => {
    const src = read("src", "app", ".well-known", dir, "route.ts");
    // A file naming an app that cannot be verified fails verification silently, which
    // is worse than an honest absence.
    expect(src).toContain("status: 404");
  });
});

describe("links handed to another person", () => {
  it("no component builds a shareable URL from the host this tab is on", () => {
    // window.location.origin is a Railway subdomain, a preview deploy or localhost
    // depending on where the page was opened, so a link, a QR or a shared trip built
    // from it can outlive the host it names. shareOrigin() is the deployment's public
    // address, falling back to the current origin only when it is not configured.
    const roots = ["src/components", "src/app"];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.tsx?$/.test(e.name)) {
          const src = readFileSync(join(process.cwd(), rel), "utf8");
          // `window.location.href = …` is a navigation, not a link someone is handed.
          // The `=` follows the match, so look after it, not before.
          for (const m of src.matchAll(/window\.location\.(origin|href)\s*(=[^=]|)/g)) {
            if (m[2].startsWith("=")) continue;
            offenders.push(`${rel}: window.location.${m[1]}`);
          }
        }
      }
    };
    roots.forEach(walk);
    expect(offenders, "use shareOrigin() from @/lib/landing instead").toEqual([]);
  });

  it("a shared trip uses the URL the API built", () => {
    const src = readFileSync(join(process.cwd(), "src/components/itinerary/ItineraryDetail.tsx"), "utf8");
    // The API knows the deployment's public address per city; this tab does not.
    expect(src).toContain("res.url ||");
  });
});
