/**
 * Assistant screenshots (docs/screenshots/assistant-*.png) from a running dev server.
 *
 *   pnpm dev:mock -p 3100
 *   BASE_URL=http://localhost:3100 pnpm screenshots:assistant
 *   SUFFIX=live-api BASE_URL=http://localhost:3101 EMAIL=… PASSWORD=… pnpm screenshots:assistant
 *
 * Shots (desktop + phone): the sheet on first open with its suggestions and the
 * provider notice, a planned trip with the itinerary card above the prose, a bike-station
 * card, an error state, and the admin "Asistente" tab.
 *
 * The live run is only honest if the city actually has the assistant on with a
 * provider key. When the entry point never appears the script says so and skips
 * the chat shots rather than staging an answer that no model produced.
 */
import { chromium } from "@playwright/test";
import { adminLogin } from "./admin-login.mjs";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = "docs/screenshots";
const SUFFIX = process.env.SUFFIX ? `-${process.env.SUFFIX}` : "";
const CITY = process.env.CITY ?? "bogota";
const HERE = { latitude: 4.6841, longitude: -74.0517 }; // Calle 100
const viewports = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };
const file = (n, vp) => `${OUT}/assistant-${n}${vp ? `-${vp}` : ""}${SUFFIX}.png`;

const waitMap = (page) => page.waitForFunction(() => !!window.__otMap, null, { timeout: 30_000 }).catch(() => console.warn("map missing"));
const settle = (page) =>
  page.waitForFunction(() => { const m = window.__otMap; return !!m && m.areTilesLoaded() && !m.isMoving(); }, null, { timeout: 30_000 }).catch(() => {});

/** Opens the sheet from whichever entry point this viewport shows. */
async function openChat(page, vpName) {
  const entry = vpName === "mobile" ? "[data-testid=assistant-open-overlay]" : "[data-testid=assistant-open-search]";
  const btn = page.locator(entry).first();
  if (!(await btn.isVisible().catch(() => false))) return false;
  await btn.click();
  return page.waitForSelector("[data-testid=assistant-sheet]", { timeout: 10_000 }).then(() => true, () => false);
}

/** Types a question and waits for the stream to stop (or for an error). */
async function ask(page, text) {
  const input = page.locator("[data-testid=assistant-sheet] input").first();
  await input.fill(text);
  await input.press("Enter");
  // wait for the request to start before waiting for it to finish, or the
  // "not busy" check passes on the frame before React flips the flag
  await page.waitForSelector("[data-testid=assistant-sheet] [aria-busy=true]", { timeout: 5000 }).catch(() => {});
  await page
    .waitForFunction(() => {
      const sheet = document.querySelector("[data-testid=assistant-sheet]");
      if (!sheet) return false;
      if (sheet.querySelector("[data-testid=assistant-error]")) return true;
      const busy = sheet.querySelector("[aria-busy=true]");
      return !busy;
    }, null, { timeout: 45_000 })
    .catch(() => console.warn(`the reply to "${text}" never finished`));
  await page.waitForTimeout(600);
}

/** How many cards are on screen; a card that never arrives is a bug, not a style. */
const cardCount = (page) => page.locator("[data-testid^=card-]").count().catch(() => 0);
let cardless = 0;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let sawChat = false;
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
    await page.goto(`${BASE}/${CITY}`);
    await waitMap(page);
    await settle(page);

    // 1 · first open: suggestions and the one-time provider notice
    if (!(await openChat(page, vpName))) {
      // Not a failure: the contract says the entry point is hidden when the city has
      // the assistant off. Record that, and do not stage an answer no model produced.
      console.warn(`!! ${vpName}: no assistant entry point — the city has it off, or the API has no provider key. Chat shots skipped.`);
      await page.screenshot({ path: file("hidden", vpName) });
      await ctx.close();
      continue;
    }
    sawChat = true;
    await page.waitForTimeout(400);
    await page.screenshot({ path: file("intro", vpName) });

    // 2 · a planned trip: the itinerary card lands above the prose
    let seen = 0;
    for (const [name, question] of [
      // the origin is spelled out: a bare "al Portal Sur" makes the live model ask where from
      ["trip", "¿Cómo llego del Parque de la 93 al Portal Sur?"],
      ["board", "¿A qué hora pasa el próximo bus en Portal Norte?"],
      // bikes: a station card, one of the kinds the renderer used to drop
      ["bikes", "¿Hay bicis cerca de la Calle 100?"],
    ]) {
      await ask(page, question);
      const now = await cardCount(page);
      if (now <= seen) {
        console.warn(`!! ${vpName}/${name}: "${question}" answered with no card`);
        cardless++;
      }
      seen = now;
      await page.screenshot({ path: file(name, vpName) });
    }

    // 5 · "new conversation": the header button asks before wiping the thread
    await page.locator("[data-testid=assistant-new]").first().click().catch(() => console.warn(`${vpName}: no new-conversation button`));
    await page.waitForTimeout(300);
    await page.screenshot({ path: file("new", vpName) });
    await page.locator("[data-testid=assistant-new-confirm-yes]").first().click().catch(() => {});
    await page.waitForTimeout(400);

    // 6 · an error state, reached through the endpoint's own refusal
    await ask(page, "presupuesto");
    const errored = await page.locator("[data-testid=assistant-error]").count().catch(() => 0);
    // No shot when the state never happened: a file named "error" showing an
    // ordinary answer is worse than no file.
    if (errored) await page.screenshot({ path: file("error", vpName) });
    else console.warn(`${vpName}: no error state on this run (the live API exposes no budget trigger); error shot skipped`);
    await ctx.close();
  }

  // 7 · the admin tab
  const admin = await browser.newContext({ viewport: viewports.desktop, locale: "es-CO" });
  const ap = await admin.newPage();
  await adminLogin(ap, BASE);
  await ap.goto(`${BASE}/admin/${CITY}#assistant`);
  await ap.waitForSelector('[id="config.assistant.provider"]', { timeout: 20_000 }).catch(() => console.warn("assistant tab did not render"));
  await ap.waitForTimeout(500);
  // The panel's mask keeps the key's last characters so an operator can tell
  // which key is stored. That is right in a browser and wrong in a PNG that
  // ships in a public repo, so blank the field for the camera only — through
  // the DOM, which leaves the form's own state (and its dirty flag) alone.
  await ap
    .evaluate(() => {
      const el = document.getElementById("config.assistant.apiKey");
      if (el instanceof HTMLInputElement && el.value) el.value = "••••••••";
    })
    .catch(() => {});
  await ap.screenshot({ path: file("admin", null) });

  // the "Probar" button: one fixed question, its answer and its cost
  const probe = ap.getByRole("button", { name: /^Probar$/ });
  if (await probe.isEnabled().catch(() => false)) {
    await probe.click();
    // the result card is appended at the end of the tab; bring it into view
    await ap.getByText(/Pregunta de prueba/).waitFor({ timeout: 45_000 }).catch(() => console.warn("the test never returned"));
    await ap.waitForTimeout(4000);
    await ap.getByText(/Pregunta de prueba/).scrollIntoViewIfNeeded().catch(() => {});
    await ap.waitForTimeout(400);
    await ap.screenshot({ path: file("admin-test", null) });
  } else {
    console.warn("!! 'Probar' is disabled — the city has the assistant off, so no test shot");
  }
  await admin.close();
} finally {
  await browser.close();
}
if (cardless) console.warn(`!! ${cardless} answer(s) rendered without a card — the renderer or the data behind it is wrong`);
if (!sawChat) console.warn("!! the chat sheet was never reachable on this run; only the admin shots were captured");
