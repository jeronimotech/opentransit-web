/**
 * "Cerca de mí" screenshots from a running dev server.
 *
 *   pnpm dev:mock -p 3100
 *   BASE_URL=http://localhost:3100 pnpm screenshots:nearme
 *   SUFFIX=live-api BASE_URL=http://localhost:3101 pnpm screenshots:nearme
 *
 * Shots (desktop + mobile): the mode with its radius circle and nearby list, a bus
 * selected from the list, and the empty state at the narrowest radius.
 *
 * Geolocation is granted and pinned to Calle 100, so the mode behaves the same on
 * every run. Bogotá's feed goes quiet late at night: when the live run finds no
 * buses the "nearby" shot is honestly the empty state, not a staged one.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = "docs/screenshots";
const SUFFIX = process.env.SUFFIX ? `-${process.env.SUFFIX}` : "";
const CITY = process.env.CITY ?? "bogota";
const HERE = { latitude: Number(process.env.LAT ?? 4.6843), longitude: Number(process.env.LON ?? -74.0579) }; // Calle 100
const viewports = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };
const file = (n, vp) => `${OUT}/${n}-${vp}${SUFFIX}.png`;

const waitMap = async (page) => {
  const ok = await page.waitForFunction(() => !!window.__otMap, null, { timeout: 15_000 }).then(() => true, () => false);
  if (!ok) {
    await page.reload();
    await page.waitForFunction(() => !!window.__otMap, null, { timeout: 30_000 }).catch(() => console.warn("map still missing"));
  }
};
const settle = (page) =>
  page
    .waitForFunction(() => { const m = window.__otMap; return !!m && m.areTilesLoaded() && !m.isMoving(); }, null, { timeout: 30_000 })
    .catch(() => {});
const visible = (page, sel) => page.locator(`${sel} >> visible=true`).first();

/** On phones the sheet starts at "peek"; pull it up so the list is on screen. */
const openSheet = async (page, vpName) => {
  if (vpName !== "mobile") return;
  for (let i = 0; i < 3; i++) {
    const handle = await page.$("[data-sheet-handle]");
    if (!handle) return;
    const box = await handle.boundingBox();
    if (!box) return;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, 260, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    if (await visible(page, "[data-testid=nearby-rows], [data-testid=nearme-empty]").count().then((n) => n > 0, () => false)) return;
  }
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let hadBuses = false;
try {
  for (const [vpName, vp] of Object.entries(viewports)) {
    const ctx = await browser.newContext({
      viewport: vp,
      locale: "es-CO",
      geolocation: HERE,
      permissions: ["geolocation"],
      hasTouch: vpName === "mobile",
      isMobile: vpName === "mobile",
    });
    const page = await ctx.newPage();

    // 1 · the mode: radius circle, follow camera, nearby list
    await page.goto(`${BASE}/${CITY}/live?near=me`);
    await waitMap(page);
    await page.waitForSelector("[data-testid=nearme-panel]", { timeout: 30_000, state: "attached" }).catch(() => console.warn("no near-me panel"));
    await openSheet(page, vpName);
    // give the stream a full frame plus a delta before judging emptiness
    await page.waitForTimeout(6000);
    await settle(page);
    const rows = await page.locator("[data-testid=nearby-rows] li").count().catch(() => 0);
    hadBuses = hadBuses || rows > 0;
    console.log(`${vpName}: ${rows} bus(es) within the radius`);
    await page.screenshot({ path: file("nearme", vpName) });

    // 2 · a bus picked from the list is the one highlighted on the map
    if (rows > 0) {
      await visible(page, "[data-testid=nearby-rows] li button").click().catch(() => {});
      await page.waitForTimeout(1500);
      await settle(page);
      await page.screenshot({ path: file("nearme-selected", vpName) });
    }

    // 3 · the narrowest radius: the circle fits on screen and the list shortens
    await page.goto(`${BASE}/${CITY}/live?near=me`);
    await waitMap(page);
    await page.waitForSelector("[data-testid=nearme-panel]", { timeout: 30_000, state: "attached" }).catch(() => {});
    await openSheet(page, vpName);
    await visible(page, "button:has-text('300 m')").click().catch(() => {});
    await page.waitForTimeout(4000);
    await settle(page);
    await page.screenshot({ path: file("nearme-radius-300", vpName) });
    await ctx.close();

    // 4 · the empty state: same mode, standing away from any corridor
    const far = await browser.newContext({
      viewport: vp,
      locale: "es-CO",
      geolocation: { latitude: Number(process.env.EMPTY_LAT ?? 4.6534), longitude: Number(process.env.EMPTY_LON ?? -74.145) },
      permissions: ["geolocation"],
      hasTouch: vpName === "mobile",
      isMobile: vpName === "mobile",
    });
    const farPage = await far.newPage();
    await farPage.goto(`${BASE}/${CITY}/live?near=me`);
    await waitMap(farPage);
    await farPage.waitForSelector("[data-testid=nearme-panel]", { timeout: 30_000, state: "attached" }).catch(() => {});
    await openSheet(farPage, vpName);
    await visible(farPage, "button:has-text('300 m')").click().catch(() => {});
    await farPage.waitForTimeout(5000);
    await settle(farPage);
    const stillThere = await farPage.locator("[data-testid=nearby-rows] li").count().catch(() => 0);
    if (stillThere > 0) console.warn(`empty-state shot still had ${stillThere} bus(es); pick a quieter EMPTY_LAT/EMPTY_LON`);
    await farPage.screenshot({ path: file("nearme-empty", vpName) });
    await far.close();
  }
} finally {
  await browser.close();
}
if (!hadBuses) console.warn("!! no vehicles were inside the radius on this run — the 'nearme' shots show the honest empty state");
