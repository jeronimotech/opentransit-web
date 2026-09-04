/**
 * Regenerates docs/screenshots/*.png from a running dev server.
 *
 *   pnpm dev:mock -p 3100        # in another terminal
 *   npx playwright install chromium   # once
 *   BASE_URL=http://localhost:3100 pnpm screenshots
 *
 * Set SUFFIX=live-api to name the files after a run against the real API,
 * and STOP=bogota:2000 / ROUTE=bogota:12873 to point at real ids.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = "docs/screenshots";
const SUFFIX = process.env.SUFFIX ?? "";
const STOP = process.env.STOP ?? "bogota:7012";
const STATION = process.env.STATION ?? "bogota:7001";
const ROUTE = process.env.ROUTE ?? "bogota:B13";
const trip = "from=4.75460,-74.04590&fromName=Portal%20Norte&to=4.59780,-74.16160&toName=Portal%20Sur";

const shots = [
  ["hub", "/bogota"],
  ["planner", `/bogota?${trip}`],
  ["itinerary", `/bogota?${trip}&it=1`],
  ["next", `/bogota/next?stop=${encodeURIComponent(STATION)}&route=${encodeURIComponent(ROUTE)}`],
  ["stop", `/bogota/stops/${encodeURIComponent(STOP)}`],
  ["favorites", "/bogota/favorites"],
  ["live", `/bogota/live?stop=${encodeURIComponent(STATION)}`],
];
const viewports = process.env.VIEWPORTS
  ? Object.fromEntries(process.env.VIEWPORTS.split(",").map((v) => [v, v === "mobile" ? { width: 390, height: 844 } : { width: 1280, height: 800 }]))
  : { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };

// seed favorites + a recent trip so those screens have content
const seed = `(() => {
  const k = "opentransit.bogota.favorites";
  const s = { v: 1, favorites: [
    { kind: "place", id: "home", placeKind: "home", name: "Calle 170 # 8-20", lat: 4.7539, lon: -74.0442 },
    { kind: "place", id: "work", placeKind: "work", name: "Calle 26 # 13-19", lat: 4.6122, lon: -74.0712 },
    { kind: "stop", id: "${STATION}", stopId: "${STATION}", name: "Portal Norte", component: "trunk" },
    { kind: "route", id: "${ROUTE}", routeId: "${ROUTE}", shortName: "B13", longName: "Portal Norte – Portal Sur", color: "#D32F2F", component: "trunk" }
  ], recents: [ { id: "r1", from: { lat: 4.7546, lon: -74.0459, name: "Portal Norte" }, to: { lat: 4.5978, lon: -74.1616, name: "Portal Sur" }, at: Date.now() } ] };
  try { localStorage.setItem(k, JSON.stringify(s)); } catch {}
})();`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  // Warm up: the dev server compiles each route on first hit, which would otherwise
  // show up as a loading spinner in the first capture of every page.
  const warm = await browser.newPage();
  for (const [, path] of shots) {
    await warm.goto(`${BASE}${path}`).catch(() => {});
    await warm.waitForTimeout(500);
  }
  await warm.close();
  for (const [vpName, vp] of Object.entries(viewports)) {
    const ctx = await browser.newContext({ viewport: vp, locale: "es-CO", geolocation: { latitude: 4.6534, longitude: -74.0836 }, permissions: ["geolocation"] });
    await ctx.addInitScript(seed);
    const page = await ctx.newPage();
    for (const [name, path] of shots) {
      await page.goto(`${BASE}${path}`);
      // the city layout shows a spinner until the City query resolves
      await page.waitForFunction(() => !!document.querySelector("h1"), null, { timeout: 30_000 }).catch(() => {});
      const hasMap = !["favorites"].includes(name);
      if (hasMap) {
        // tiles + a still camera is enough; `loaded()` flickers while live layers update
        await page
          .waitForFunction(
            () => {
              const m = window.__otMap;
              return !!m && m.areTilesLoaded() && !m.isMoving();
            },
            null,
            { timeout: 30_000 },
          )
          .catch(() => console.warn("map not settled for", name, "- capturing anyway"));
      }
      // let boards/streams settle
      await page.waitForTimeout(name === "live" || name === "next" ? 5_000 : 1_500);
      const file = `${OUT}/${name}-${vpName}${SUFFIX ? `-${SUFFIX}` : ""}.png`;
      await page.screenshot({ path: file });
      console.log("saved", file);
    }
    await page.close();
    await ctx.close();
  }
} finally {
  await browser.close();
}
