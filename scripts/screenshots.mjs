/**
 * Regenerates docs/screenshots/*.png from a running dev server.
 *
 *   pnpm dev:mock -p 3100        # in another terminal
 *   npx playwright install chromium   # once
 *   BASE_URL=http://localhost:3100 pnpm screenshots
 *
 * Set SUFFIX=live-api to name the files after a run against the real API,
 * and STOP=bogota:2000 / ROUTE=bogota:12873 to point at real ids.
 * Shots: hub (sheet peeking), hub-expanded (sheet pulled up), hub-zoom (street zoom with live buses),
 * planner (form), results, itinerary, next (Ubica tu bus), stop (board above the fold), favorites, live.
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

const ONLY = process.env.SHOTS ? process.env.SHOTS.split(",") : null;
/** [name, path, action] — action runs before the capture (interaction, camera). */
const shots = [
  ["hub", "/bogota", null],
  ["hub-expanded", "/bogota", "expand"],
  ["hub-zoom", "/bogota", "zoom"],
  ["planner", "/bogota?view=plan", null],
  ["results", `/bogota?${trip}`, null],
  ["itinerary", `/bogota?${trip}&it=1`, null],
  ["next", `/bogota/next?stop=${encodeURIComponent(STATION)}&route=${encodeURIComponent(ROUTE)}`, null],
  ["stop", `/bogota/stops/${encodeURIComponent(STOP)}`, null],
  ["favorites", "/bogota/favorites", null],
  ["live", `/bogota/live?stop=${encodeURIComponent(STATION)}`, "zoom"],
].filter(([n]) => !ONLY || ONLY.includes(n));
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

const settle = (page) =>
  page
    .waitForFunction(
      () => {
        const m = window.__otMap;
        return !!m && m.areTilesLoaded() && !m.isMoving();
      },
      null,
      { timeout: 30_000 },
    )
    .catch(() => console.warn("map not settled - capturing anyway"));

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  const warm = await browser.newPage();
  for (const [, path] of shots) {
    await warm.goto(`${BASE}${path}`).catch(() => {});
    await warm.waitForTimeout(500);
  }
  await warm.close();
  for (const [vpName, vp] of Object.entries(viewports)) {
    const ctx = await browser.newContext({ viewport: vp, locale: "es-CO", geolocation: { latitude: 4.7546, longitude: -74.0459 }, permissions: ["geolocation"], hasTouch: vpName === "mobile", isMobile: vpName === "mobile" });
    await ctx.addInitScript(seed);
    const page = await ctx.newPage();
    for (const [name, path, action] of shots) {
      await page.goto(`${BASE}${path}`);
      const content = () => page.waitForFunction(() => !!document.querySelector("h1, h2, form"), null, { timeout: 15_000 }).then(() => true, () => false);
      if (!(await content())) {
        // the dev server occasionally leaves a chunk request hanging; a reload clears it
        console.warn("no content for", name, "- reloading");
        await page.reload();
        await content();
      }
      const hasMap = !["favorites"].includes(name);
      if (hasMap) await settle(page);
      if (name.startsWith("hub")) {
        // "Cerca de ti" needs a position: press the locate control (it is granted above)
        const locate = page.getByRole("button", { name: /Mi ubicación|My location|Ver qué hay cerca/ }).first();
        if (await locate.count()) await locate.click().catch(() => {});
        await page.waitForTimeout(800);
      }
      if (action === "expand") {
        if (vpName === "mobile") {
          const handle = page.locator("[data-sheet-handle]");
          const box = await handle.boundingBox();
          if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width / 2, box.y - 380, { steps: 12 });
            await page.mouse.up();
          }
        }
      }
      if (action === "zoom") {
        await page.evaluate(() => window.__otMap?.jumpTo({ center: [-74.0459, 4.7546], zoom: 16.2 }));
        await page.waitForTimeout(400);
        if (hasMap) await settle(page);
      }
      await page.waitForTimeout(name === "live" || name === "next" || name.startsWith("hub") ? 4_000 : 1_500);
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
