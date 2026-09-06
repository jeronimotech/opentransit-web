/**
 * Lote 1 (Citymapper UX) + analytics screenshots from a running dev server.
 *
 *   pnpm dev:mock -p 3100
 *   BASE_URL=http://localhost:3100 pnpm screenshots:lote1
 *   SUFFIX=live-api TOKEN=<ADMIN_TOKEN> STOP=bogota:2000 TRIP="from=…&to=…" pnpm screenshots:lote1
 *
 * Shots (desktop + mobile): results with scenario sections and countdowns, itinerary detail
 * with departure chips, stop board rows, the offline bar; desktop: admin Analítica (map + charts).
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = "docs/screenshots";
const SUFFIX = process.env.SUFFIX ? `-${process.env.SUFFIX}` : "";
const TOKEN = process.env.TOKEN ?? "demo";
const STOP = process.env.STOP ?? "bogota:7012";
const trip = process.env.TRIP ?? "from=4.68450,-74.05300&fromName=Chic%C3%B3%20Norte&to=4.59780,-74.16160&toName=Portal%20Sur&rental=1&taxi=1";
const viewports = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };
const file = (n, vp) => `${OUT}/${n}-${vp}${SUFFIX}.png`;

const waitMap = async (page) => {
  const ok = await page.waitForFunction(() => !!window.__otMap, null, { timeout: 15_000 }).then(() => true, () => false);
  if (!ok) {
    await page.reload();
    await page.waitForFunction(() => !!window.__otMap, null, { timeout: 30_000 }).catch(() => console.warn("map still missing"));
  }
};
const settle = (page) => page.waitForFunction(() => { const m = window.__otMap; return !!m && m.areTilesLoaded() && !m.isMoving(); }, null, { timeout: 30_000 }).catch(() => {});
const waitFor = (page, sel, timeout = 45_000) => page.waitForSelector(sel, { timeout }).catch(() => console.warn(`missing ${sel}`));

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [vpName, vp] of Object.entries(viewports)) {
    const ctx = await browser.newContext({ viewport: vp, locale: "es-CO", geolocation: { latitude: 4.6845, longitude: -74.053 }, permissions: ["geolocation"], hasTouch: vpName === "mobile", isMobile: vpName === "mobile" });
    const page = await ctx.newPage();

    // 1 · results grouped by scenario with countdowns
    await page.goto(`${BASE}/bogota?${trip}`);
    await waitMap(page);
    await waitFor(page, "[data-testid=results]");
    await settle(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: file("lote1-results", vpName) });

    // 2 · itinerary detail with departure chips (first transit itinerary)
    const idx = await page.evaluate(() => {
      const sections = [...document.querySelectorAll("[data-testid^=scenario-]")];
      const s = sections.find((x) => x.dataset.testid === "scenario-fastest") ?? sections[0];
      const sr = s?.querySelector("button[aria-pressed] .sr-only")?.textContent ?? "";
      const m = sr.match(/(\d+)\s*$/);
      return m ? Number(m[1]) - 1 : 0;
    });
    await page.goto(`${BASE}/bogota?${trip}&it=${idx}`);
    await waitMap(page);
    await waitFor(page, "[data-testid=departure-chips]", 30_000);
    await settle(page);
    await page.waitForTimeout(600);
    await page.screenshot({ path: file("lote1-itinerary", vpName) });

    // 3 · stop board rows
    await page.goto(`${BASE}/bogota/stops/${encodeURIComponent(STOP)}`);
    await waitMap(page);
    await waitFor(page, "[data-testid=board-rows]", 30_000);
    await settle(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: file("lote1-stop", vpName) });

    // 4 · offline bar
    await ctx.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await page.waitForSelector("[data-testid=netbar-severe]", { timeout: 5_000 }).catch(() => {});
    await page.screenshot({ path: file("lote1-offline", vpName) });
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    if (vpName === "desktop") {
      // 5 · admin analytics
      await page.goto(`${BASE}/admin`);
      await page.fill("input[type=password], input[name=token]", TOKEN).catch(() => {});
      await page.click("button[type=submit]").catch(() => {});
      await page.goto(`${BASE}/admin/bogota#analytics`);
      await page.waitForSelector("[data-testid=analytics-tab]", { timeout: 45_000 }).catch(() => console.warn("analytics tab missing"));
      await page.waitForSelector("[data-testid=kpi-row]", { timeout: 45_000 }).catch(() => {});
      await page.waitForFunction(() => !!window.__otMap, null, { timeout: 20_000 }).catch(() => {});
      await settle(page);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: file("analytics-admin", vpName) });
      await page.screenshot({ path: file("analytics-admin-full", vpName), fullPage: true });
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log("done");
