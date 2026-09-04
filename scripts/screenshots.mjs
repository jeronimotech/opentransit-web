/**
 * Regenerates docs/screenshots/*.png from a running dev server.
 *
 *   pnpm dev:mock            # in another terminal (port 3000, or set BASE_URL)
 *   npx playwright install chromium   # once
 *   pnpm screenshots
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "docs/screenshots";
const trip = "from=4.75460,-74.04590&fromName=Portal%20Norte&to=4.59780,-74.16160&toName=Portal%20Sur";

const shots = [
  ["planner", `/bogota?${trip}`],
  ["itinerary", `/bogota?${trip}&it=1`],
  ["live", "/bogota/live"],
  ["stop", "/bogota/stops/bogota%3A7012"],
];
const viewports = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [vpName, vp] of Object.entries(viewports)) {
    const page = await browser.newPage({ viewport: vp, locale: "es-CO" });
    for (const [name, path] of shots) {
      await page.goto(`${BASE}${path}`);
      await page.waitForFunction(
        () => {
          const m = window.__otMap;
          return !!m && m.loaded() && m.areTilesLoaded() && !m.isMoving();
        },
        null,
        { timeout: 60_000 },
      );
      await page.waitForTimeout(800);
      const file = `${OUT}/${name}-${vpName}.png`;
      await page.screenshot({ path: file });
      console.log("saved", file);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
