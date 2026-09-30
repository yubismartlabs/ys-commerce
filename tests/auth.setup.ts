import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Signs in through the real form and persists the session so the rest of the
 * suite doesn't repeat a login per spec. Also acts as a smoke test of the
 * credentials flow itself.
 */
const SELLER = { email: "seller1@ys.local", password: "seller123" };
const AUTH_DIR = path.join(process.cwd(), "playwright", ".auth");

setup("sign in as a seller", async ({ page }) => {
  await page.goto("/sign-in");

  await page.getByLabel("Email").fill(SELLER.email);
  await page.getByLabel("Password").fill(SELLER.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // A failed sign-in leaves us on /sign-in with an alert; a successful one
  // navigates away, so assert on the destination rather than a spinner.
  await expect(page).not.toHaveURL(/\/sign-in/);

  // Confirm the session is really usable, not just that the URL changed.
  await page.goto("/selling/listings");
  await expect(page.getByRole("heading", { name: /listings/i })).toBeVisible();

  mkdirSync(AUTH_DIR, { recursive: true });
  await page.context().storageState({ path: path.join(AUTH_DIR, "seller.json") });
});
