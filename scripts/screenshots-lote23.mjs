/**
 * Lote 2 + 3 screenshots from a running dev server.
 *
 *   pnpm dev:mock -p 3100
 *   BASE_URL=http://localhost:3100 pnpm screenshots:lote23
 *   SUFFIX=live-api BASE_URL=http://localhost:3101 ROUTE=bogota:12873 TOKEN=<share token> pnpm screenshots:lote23
 *
 * Shots (desktop + mobile): the Casa ⇄ Trabajo card on the home sheet, the
 * "Cuándo salir" panel over the results, the line page with buses on the stop
 * timeline, and the public shared-ETA page.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = "docs/screenshots";
const SUFFIX = process.env.SUFFIX ? `-${process.env.SUFFIX}` : "";
const CITY = process.env.CITY ?? "bogota";
const ROUTE = process.env.ROUTE ?? "bogota:B13"; // mock ids are bogota:<shortName>; live Bogotá uses numeric ids
const SHARE = process.env.TOKEN ?? "demo";
const trip = process.env.TRIP ?? "from=4.68450,-74.05300&fromName=Chic%C3%B3%20Norte&to=4.59780,-74.16160&toName=Portal%20Sur";
const viewports = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };
const file = (n, vp) => `${OUT}/${n}-${vp}${SUFFIX}.png`;

/** Casa and Trabajo, so the commute card has something to plan. */
const FAVORITES = {
  v: 1,
  favorites: [
    { kind: "place", id: "home", placeKind: "home", name: "Casa · Chicó Norte", lat: 4.6845, lon: -74.053 },
    { kind: "place", id: "work", placeKind: "work", name: "Trabajo · Portal Sur", lat: 4.5978, lon: -74.1616 },
  ],
  recents: [],
};

const waitMap = async (page) => {
  const ok = await page.waitForFunction(() => !!window.__otMap, null, { timeout: 15_000 }).then(() => true, () => false);
  if (!ok) {
    await page.reload();
    await page.waitForFunction(() => !!window.__otMap, null, { timeout: 30_000 }).catch(() => console.warn("map still missing"));
  }
};
const settle = (page) =>
  page.waitForFunction(() => { const m = window.__otMap; return !!m && m.areTilesLoaded() && !m.isMoving(); }, null, { timeout: 30_000 }).catch(() => {});
const waitFor = (page, sel, timeout = 45_000) => page.waitForSelector(sel, { timeout, state: "attached" }).catch(() => console.warn(`missing ${sel}`));
/**
 * SplitLayout renders the panel twice — a desktop <aside> hidden below md, and the
 * phone sheet — so a bare selector matches the *hidden* copy first. Everything
 * interactive therefore goes through `:visible`.
 */
const visible = (page, sel) => page.locator(`${sel} >> visible=true`).first();

/**
 * On phones the expanded content is not mounted at "peek", so the sheet has to be
 * dragged open before the shot; it snaps to the nearest stop on pointer-up.
 */
const openSheet = async (page, vpName, sel) => {
  if (vpName !== "mobile") return;
  for (let i = 0; i < 3; i++) {
    if (await visible(page, sel).count().then((n) => n > 0, () => false)) {
      await visible(page, sel).scrollIntoViewIfNeeded().catch(() => {});
      return;
    }
    const handle = await page.$("[data-sheet-handle]");
    if (!handle) return;
    const box = await handle.boundingBox();
    if (!box) return;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, 120, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(700);
  }
  await visible(page, sel).scrollIntoViewIfNeeded().catch(() => {});
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [vpName, vp] of Object.entries(viewports)) {
    const ctx = await browser.newContext({
      viewport: vp,
      locale: "es-CO",
      geolocation: { latitude: 4.6845, longitude: -74.053 },
      permissions: ["geolocation"],
      hasTouch: vpName === "mobile",
      isMobile: vpName === "mobile",
    });
    await ctx.addInitScript(
      ([city, favs]) => {
        try {
          localStorage.setItem(`opentransit.${city}.favorites`, JSON.stringify(favs));
        } catch {}
      },
      [CITY, FAVORITES],
    );
    const page = await ctx.newPage();

    // 1 · home with the Casa ⇄ Trabajo card (phones need the sheet pulled up)
    await page.goto(`${BASE}/${CITY}`);
    await waitMap(page);
    if (vpName === "mobile") {
      // tapping the handle cycles peek → half → full; one tap is enough to reveal the card
      // the handle is aria-hidden, so Playwright's visibility check is bypassed
      for (let i = 0; i < 2; i++) {
        if (await page.$("[data-testid=commute-card], [data-testid=commute-empty]")) break;
        const handle = await page.$("[data-sheet-handle]");
        if (!handle) break;
        await handle.click({ force: true }).catch(async () => {
          const box = await handle.boundingBox();
          if (!box) return;
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(box.x + box.width / 2, 200, { steps: 10 });
          await page.mouse.up();
        });
        await page.waitForTimeout(600);
      }
    }
    await openSheet(page, vpName, "[data-testid=commute-card], [data-testid=commute-empty]");
    await waitFor(page, "[data-testid=commute-card], [data-testid=commute-empty]");
    await settle(page);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: file("lote23-commute", vpName) });

    // 2 · results + the "Cuándo salir" panel
    await page.goto(`${BASE}/${CITY}?${trip}`);
    await waitMap(page);
    await waitFor(page, "[data-testid=results]");
    await settle(page);
    await openSheet(page, vpName, "[data-testid=forecast-open]");
    // the phone sheet sets touch-action:none below "full", which swallows a synthetic
    // tap, so the click is dispatched on the laid-out copy of the button instead
    const opened = await page.evaluate(() => {
      const el = [...document.querySelectorAll("[data-testid=forecast-open]")].find((e) => e.getBoundingClientRect().height > 0);
      el?.click();
      return !!el;
    });
    if (!opened) console.warn("forecast button not found");
    await waitFor(page, "[data-testid=forecast-rows], [data-testid=forecast]");
    await openSheet(page, vpName, "[data-testid=forecast]");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: file("lote23-forecast", vpName) });

    // 3 · line page: buses on the stop timeline + GO rápido
    await page.goto(`${BASE}/${CITY}/routes/${encodeURIComponent(ROUTE)}`);
    await waitMap(page);
    await waitFor(page, "[data-testid=line-timeline]");
    await openSheet(page, vpName, "[data-testid=line-timeline]");
    await settle(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: file("lote23-line", vpName) });

    // 4 · the public shared-ETA page
    await page.goto(`${BASE}/${CITY}/eta/${encodeURIComponent(SHARE)}`, { waitUntil: "domcontentloaded" });
    let shareReady = await page
      .waitForSelector("[data-testid=share-view], [data-testid=share-gone]", { timeout: 20_000, state: "attached" })
      .then(() => true, () => false);
    if (!shareReady) {
      await page.reload({ waitUntil: "domcontentloaded" });
      shareReady = await page
        .waitForSelector("[data-testid=share-view], [data-testid=share-gone]", { timeout: 30_000, state: "attached" })
        .then(() => true, () => false);
    }
    if (!shareReady) console.warn("missing share view");
    await settle(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: file("lote23-share", vpName) });

    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    if (errors.length) console.warn("console errors:", errors.slice(0, 5));
    await ctx.close();
  }
  console.log(`done → ${OUT}/lote23-*${SUFFIX}.png`);
} finally {
  await browser.close();
}
