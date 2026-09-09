/**
 * Shared sign-in for the screenshot scripts.
 *
 * The admin session is an httpOnly cookie set by the web's own /api/admin proxy, so it cannot be
 * seeded from a page script the way the old shared token could. Sign in through the form once and
 * pass the resulting context around (or reuse `storageState()` for a second viewport).
 */
export const ADMIN_EMAIL = process.env.EMAIL ?? "demo@opentransit.dev";
export const ADMIN_PASSWORD = process.env.PASSWORD ?? "demo-password";

export async function adminLogin(page, base, { email = ADMIN_EMAIL, password = ADMIN_PASSWORD } = {}) {
  await page.goto(`${base}/admin/login`);
  await page.getByLabel("Correo").waitFor({ timeout: 30_000 });
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 30_000 });
}
