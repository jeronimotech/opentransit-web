/**
 * Admin section screenshots (docs/screenshots/admin-*.png) from a running dev server.
 *
 *   pnpm dev:mock -p 3100                       # mock: token "demo"
 *   BASE_URL=http://localhost:3100 pnpm screenshots:admin
 *   TOKEN=<ADMIN_TOKEN> SUFFIX=live-api ...     # against the real API
 *
 * Flow: login (empty) → wrong token error → login → Tarifas with a validation error →
 * save base=NEW_BASE → saved state with revision + badges → Historial. With RESET=1 the
 * override is removed at the end (used for the live run so Bogotá goes back to YAML).
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = "docs/screenshots";
const SUFFIX = process.env.SUFFIX ? `-${process.env.SUFFIX}` : "";
const TOKEN = process.env.TOKEN ?? "demo";
const CITY = process.env.CITY ?? "bogota";
const NEW_BASE = process.env.NEW_BASE ?? "3400";
const RESET = process.env.RESET === "1";
const file = (n) => `${OUT}/admin-${n}${SUFFIX}.png`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "es-CO" });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/admin`);
  await page.getByLabel("Token").waitFor();
  await page.screenshot({ path: file("login") });

  await page.getByLabel("Token").fill("wrong-token");
  await page.getByRole("button", { name: /Entrar/ }).click();
  await page.getByRole("alert").waitFor({ timeout: 15_000 });
  await page.screenshot({ path: file("login-error") });

  await page.getByLabel("Token").fill(TOKEN);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await page.getByRole("link", { name: /Configurar/ }).first().waitFor({ timeout: 15_000 });
  await page.screenshot({ path: file("cities") });

  await page.goto(`${BASE}/admin/${CITY}#fares`);
  const base = page.locator("#fares-base");
  await base.waitFor({ timeout: 15_000 });
  await base.fill("-1");
  await page.locator("#fares-window").fill("900");
  await page.getByRole("alert").first().waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: file("fares-error") });

  await page.locator("#fares-window").fill("110");
  await base.fill(NEW_BASE);
  await page.getByPlaceholder(/Por qué se cambia/).fill("Ajuste de tarifa");
  await page.getByPlaceholder(/Tu nombre/).fill("Operador TMSA");
  await page.getByRole("button", { name: /^Guardar$/ }).click();
  await page.getByText(/Guardado · Revisión/).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: file("fares-saved") });

  await page.getByRole("tab", { name: /Historial/ }).click();
  await page.getByRole("table").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: file("history") });

  // Phone viewport of the fares form, reusing the session token
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-CO", isMobile: true, hasTouch: true });
  await m.addInitScript((t) => sessionStorage.setItem("opentransit.admin.token", t), TOKEN);
  const mp = await m.newPage();
  await mp.goto(`${BASE}/admin/${CITY}#fares`);
  await mp.locator("#fares-base").waitFor({ timeout: 45_000 });
  await mp.waitForTimeout(400);
  await mp.screenshot({ path: file("fares-mobile") });
  await m.close();

  if (RESET) {
    await page.getByRole("tab", { name: /Tarifas/ }).click();
    await page.getByRole("button", { name: /Restablecer a YAML/ }).click();
    await page.getByRole("button", { name: /^Confirmar$/ }).click();
    await page.getByText(/Guardado · Revisión/).waitFor({ timeout: 15_000 });
    console.log("override reset");
  }
  console.log("admin screenshots saved to", OUT);
} finally {
  await browser.close();
}
