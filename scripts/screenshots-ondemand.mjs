/**
 * On-demand (taxi / ride-hailing) screenshots → docs/screenshots/ondemand-*.png from a running dev server.
 *
 *   pnpm dev:mock -p 3100
 *   BASE_URL=http://localhost:3100 pnpm screenshots:ondemand
 *   SUFFIX=live-api TOKEN=<ADMIN_TOKEN> ...    # against the real API
 *
 * Shots (desktop + mobile): planner with "Taxi / app" on, results with an on-demand itinerary,
 * itinerary detail with the provider picker, the stop page action; desktop only: the admin
 * tariff editor and the providers editor.
 * Trip: Chicó Norte → Portal Sur (direct taxi + Taxi → Bus combo).
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = "docs/screenshots";
const SUFFIX = process.env.SUFFIX ? `-${process.env.SUFFIX}` : "";
const TOKEN = process.env.TOKEN ?? "demo";
// mock fixture station by default; pass STOP=bogota:2000 (Portal Norte) against the real API
const STOP = process.env.STOP ?? "bogota:7012";
const file = (n, vp) => `${OUT}/ondemand-${n}-${vp}${SUFFIX}.png`;
const trip = process.env.TRIP ?? "from=4.68450,-74.05300&fromName=Chic%C3%B3%20Norte&to=4.59780,-74.16160&toName=Portal%20Sur&taxi=1";
const viewports = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };

const waitMap = async (page) => {
  const ok = await page.waitForFunction(() => !!window.__otMap, null, { timeout: 15_000 }).then(() => true, () => false);
  if (!ok) {
    console.warn("map did not init - reloading");
    await page.reload();
    await page.waitForFunction(() => !!window.__otMap, null, { timeout: 30_000 }).catch(() => console.warn("map still missing"));
  }
};
const settle = (page) =>
  page
    .waitForFunction(() => {
      const m = window.__otMap;
      return !!m && m.areTilesLoaded() && !m.isMoving();
    }, null, { timeout: 30_000 })
    .catch(() => console.warn("map not settled - capturing anyway"));
const results = (page) => page.waitForFunction(() => document.body.innerText.includes("Rutas sugeridas") || document.body.innerText.includes("No encontramos"), null, { timeout: 45_000 }).catch(() => {});
/** Wait for some text; the dev server occasionally hangs a chunk on navigation, so reload once and retry. */
const waitText = async (page, re, timeout = 20_000) => {
  const ok = await page.waitForFunction((src) => new RegExp(src, "i").test(document.body.innerText), re.source, { timeout }).then(() => true, () => false);
  if (ok) return true;
  console.warn(`text ${re} missing - reloading`);
  await page.reload({ waitUntil: "domcontentloaded" });
  return page.waitForFunction((src) => new RegExp(src, "i").test(document.body.innerText), re.source, { timeout: 45_000 }).then(() => true, () => false);
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [vpName, vp] of Object.entries(viewports)) {
    const ctx = await browser.newContext({ viewport: vp, locale: "es-CO", geolocation: { latitude: 4.6845, longitude: -74.053 }, permissions: ["geolocation"], hasTouch: vpName === "mobile", isMobile: vpName === "mobile" });
    const page = await ctx.newPage();

    // 1 · planner form with the chip on
    await page.goto(`${BASE}/bogota?view=plan&taxi=1`);
    await waitMap(page);
    await settle(page);
    // close the autofocused suggestions and scroll the mode rail so the "Taxi / app" chip shows on phones
    await page.evaluate(() => {
      (document.activeElement instanceof HTMLElement ? document.activeElement : null)?.blur();
      document.querySelector("[data-testid=mode-taxi]")?.scrollIntoView({ inline: "end", block: "nearest" });
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: file("planner", vpName) });

    // 2 · results with an on-demand itinerary
    await page.goto(`${BASE}/bogota?${trip}`);
    await waitMap(page);
    await results(page);
    await settle(page);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: file("results", vpName) });

    // 3 · detail: first itinerary with a car leg (combo preferred)
    const idx = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("button[aria-pressed]")].filter((b) => b.querySelector(".strip"));
      const combo = cards.findIndex((c) => /Taxi → Bus/i.test(c.textContent ?? ""));
      if (combo >= 0) return combo;
      return cards.findIndex((c) => /Taxi|Precio en la app|≈/i.test(c.textContent ?? ""));
    });
    await page.goto(`${BASE}/bogota?${trip}&it=${Math.max(0, idx)}`);
    await waitMap(page);
    await page.waitForFunction(() => document.body.innerText.includes("Pide tu vehículo") || document.body.innerText.includes("Request your ride") || document.body.innerText.includes("Volver"), null, { timeout: 45_000 }).catch(() => {});
    await settle(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: file("itinerary", vpName), fullPage: vpName === "mobile" });

    // 4 · stop page with the "Llegar en taxi / app" action
    await page.goto(`${BASE}/bogota/stops/${encodeURIComponent(STOP)}`, { waitUntil: "domcontentloaded" });
    if (!(await waitText(page, /Llegar en taxi|Get here by taxi/))) console.warn("no stop taxi action");
    // hydration can re-render once more: scroll twice with a pause in between
    for (let i = 0; i < 2; i++) {
      await page.waitForTimeout(1200);
      await page.evaluate(() => document.querySelector("[data-testid=stop-taxi]")?.scrollIntoView({ block: "center" }));
    }
    await page.waitForTimeout(600);
    await page.screenshot({ path: file("stop", vpName) });

    await page.close();
    await ctx.close();
  }

  // 5 · admin: tariff editor and providers editor
  const ctx = await browser.newContext({ viewport: viewports.desktop, locale: "es-CO" });
  await ctx.addInitScript((t) => sessionStorage.setItem("opentransit.admin.token", t), TOKEN);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/bogota#mobility`);
  await page.locator("[data-testid=tariff-preview]").first().waitFor({ timeout: 30_000 });
  await page.locator("[data-testid=tariff-0]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: file("admin-tariff", "desktop") });
  await page.locator("[data-testid=provider-0]").scrollIntoViewIfNeeded();
  const testBtn = page.locator("[data-testid=provider-1]").getByRole("button", { name: /Probar enlace|Test link/ });
  if (await testBtn.count()) {
    await testBtn.first().click();
    await page.waitForSelector("[data-testid=handoff-result-1]", { timeout: 15_000 }).catch(() => console.warn("no handoff result"));
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: file("admin-providers", "desktop") });
  await ctx.close();
  console.log("on-demand screenshots saved to", OUT);
} finally {
  await browser.close();
}
