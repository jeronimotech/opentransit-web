/**
 * Shared-bike (GBFS) screenshots → docs/screenshots/bike-*.png from a running dev server.
 *
 *   pnpm dev:mock -p 3100
 *   BASE_URL=http://localhost:3100 pnpm screenshots:bike
 *   SUFFIX=live-api TOKEN=<ADMIN_TOKEN> ...    # against the real API
 *
 * Shots (desktop + mobile): planner with "Bici pública" on, results with a rental itinerary,
 * itinerary detail with pick-up / drop-off cards, the station layer with a popup, admin Movilidad.
 * Trips: Parque de la 93 → Calle 100 (bike only) and Chapinero → Portal Norte (bike + bus).
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = "docs/screenshots";
const SUFFIX = process.env.SUFFIX ? `-${process.env.SUFFIX}` : "";
const TOKEN = process.env.TOKEN ?? "demo";
const file = (n, vp) => `${OUT}/bike-${n}-${vp}${SUFFIX}.png`;
// Trips: bike only (Parque de la 93 → Calle 100) and bike + bus (Chicó Norte → Portal Sur, rental access leg)
const direct = process.env.DIRECT ?? "from=4.67660,-74.04830&fromName=Parque%20de%20la%2093&to=4.68410,-74.05170&toName=Calle%20100&modes=WALK&rental=1";
const combo = process.env.COMBO ?? "from=4.68450,-74.05300&fromName=Chic%C3%B3%20Norte&to=4.59780,-74.16160&toName=Portal%20Sur&rental=1";
const viewports = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };

/** The dev server occasionally leaves a chunk request hanging; a reload clears it. */
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

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [vpName, vp] of Object.entries(viewports)) {
    const ctx = await browser.newContext({ viewport: vp, locale: "es-CO", geolocation: { latitude: 4.6766, longitude: -74.0483 }, permissions: ["geolocation"], hasTouch: vpName === "mobile", isMobile: vpName === "mobile" });
    const page = await ctx.newPage();

    // 1 · planner form with the chip on
    await page.goto(`${BASE}/bogota?view=plan&rental=1`);
    await waitMap(page);
    await settle(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: file("planner", vpName) });

    // 2 · results: bike-only trip
    await page.goto(`${BASE}/bogota?${direct}`);
    await waitMap(page);
    await page.waitForFunction(() => document.body.innerText.includes("Rutas sugeridas") || document.body.innerText.includes("No encontramos"), null, { timeout: 45_000 }).catch(() => {});
    await settle(page);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: file("results", vpName) });

    // 3 · itinerary detail (first itinerary of the combo trip that has a rental leg)
    await page.goto(`${BASE}/bogota?${combo}`);
    await page.waitForFunction(() => document.body.innerText.includes("Rutas sugeridas") || document.body.innerText.includes("No encontramos"), null, { timeout: 45_000 }).catch(() => {});
    const idx = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("button[aria-pressed]")].filter((b) => b.querySelector(".strip"));
      const i = cards.findIndex((c) => /bici|bike/i.test(c.textContent ?? ""));
      return i;
    });
    await page.goto(`${BASE}/bogota?${combo}&it=${Math.max(0, idx)}`);
    await waitMap(page);
    await page.waitForFunction(() => document.body.innerText.includes("Toma una bici") || document.body.innerText.includes("Pick up a bike") || document.body.innerText.includes("Volver"), null, { timeout: 45_000 }).catch(() => {});
    await settle(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: file("itinerary", vpName) });

    // 4 · station layer + popup at street zoom around Calle 93 / Cra 11
    await page.goto(`${BASE}/bogota`);
    await waitMap(page);
    await page.evaluate(() => window.__otMap?.jumpTo({ center: [-74.0505, 4.678], zoom: 15.6 }));
    await settle(page);
    await page.waitForTimeout(2500);
    // click the ring nearest the centre
    const pt = await page.evaluate(() => {
      const m = window.__otMap;
      const feats = m.queryRenderedFeatures(undefined, { layers: ["rental-ring"] });
      if (!feats.length) return null;
      const c = m.getCenter();
      let best = null, bd = Infinity;
      for (const f of feats) {
        const [lon, lat] = f.geometry.coordinates;
        const d = (lon - c.lng) ** 2 + (lat - c.lat) ** 2;
        if (d < bd) { bd = d; best = m.project([lon, lat]); }
      }
      return best ? { x: best.x, y: best.y } : null;
    });
    if (pt) {
      const box = await page.locator("[role=application]").boundingBox();
      await page.mouse.click((box?.x ?? 0) + pt.x, (box?.y ?? 0) + pt.y);
      await page.waitForSelector("[role=dialog]", { timeout: 10_000 }).catch(() => console.warn("no station popup"));
      await page.waitForTimeout(800);
    } else console.warn("no rental rings rendered");
    await page.screenshot({ path: file("map", vpName) });
    await page.close();
    await ctx.close();
  }

  // 5 · admin Movilidad
  const ctx = await browser.newContext({ viewport: viewports.desktop, locale: "es-CO" });
  await ctx.addInitScript((t) => sessionStorage.setItem("opentransit.admin.token", t), TOKEN);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/bogota#mobility`);
  await page.locator("#mob-0-gbfs").waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: /Probar feed/ }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: file("admin", "desktop") });
  await ctx.close();
  console.log("bike screenshots saved to", OUT);
} finally {
  await browser.close();
}
