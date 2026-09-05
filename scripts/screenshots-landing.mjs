/**
 * City landing + admin "Página" tab screenshots (docs/screenshots/landing-*.png).
 *
 *   pnpm dev:mock -p 3100
 *   BASE_URL=http://localhost:3100 pnpm screenshots:landing
 *   SUFFIX=live-api TOKEN=<ADMIN_TOKEN> ...           # against the real API
 *
 * Shots: landing (top, desktop + mobile), landing-full (full page, desktop), admin-landing (tab),
 * landing-preview (draft with a changed title, via sessionStorage handshake).
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = "docs/screenshots";
const SUFFIX = process.env.SUFFIX ? `-${process.env.SUFFIX}` : "";
const TOKEN = process.env.TOKEN ?? "demo";
const CITY = process.env.CITY ?? "bogota";
const ADMIN = process.env.ADMIN !== "0";
const file = (n) => `${OUT}/landing-${n}${SUFFIX}.png`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const settle = async (page) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => Promise.all(Array.from(document.images).filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; })))).catch(() => {});
  await page.waitForTimeout(400);
};
try {
  for (const [name, vp, mobile] of [
    ["desktop", { width: 1280, height: 800 }, false],
    ["mobile", { width: 390, height: 844 }, true],
  ]) {
    const ctx = await browser.newContext({ viewport: vp, locale: "es-CO", isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/${CITY}/landing`);
    await page.locator("h1").waitFor({ timeout: 60_000 });
    await settle(page);
    await page.screenshot({ path: file(name) });
    if (!mobile) await page.screenshot({ path: file("full"), fullPage: true });
    await ctx.close();
  }

  if (ADMIN) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "es-CO" });
    await ctx.addInitScript((t) => sessionStorage.setItem("opentransit.admin.token", t), TOKEN);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin/${CITY}#landing`);
    await page.locator("#lp-title").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: file("admin") });

    // preview handshake: change the title, open the preview in a popup
    await page.locator("#lp-title").fill("Título de prueba desde el borrador");
    const [popup] = await Promise.all([ctx.waitForEvent("page"), page.getByRole("button", { name: /Vista previa|Preview/ }).click()]);
    await popup.locator("h1").waitFor({ timeout: 60_000 });
    await settle(popup);
    await popup.screenshot({ path: file("preview") });
    await ctx.close();
  }
  console.log("landing screenshots saved to", OUT);
} finally {
  await browser.close();
}
