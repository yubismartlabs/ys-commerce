import { expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Signs in through the real form and persists the session, so specs don't repeat
 * a login. Also acts as the smoke test of the credentials flow itself.
 */
export const SELLER = { email: "seller1@ys.local", password: "seller123" };
export const SELLER2 = { email: "seller2@ys.local", password: "seller123" };
export const BUYER = { email: "buyer@ys.local", password: "buyer123" };
// Mirrors prisma/seed.ts, which seeds the admin from the same env vars.
export const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? "admin@ys.local",
  password: process.env.ADMIN_PASSWORD ?? "admin123",
};

const AUTH_DIR = path.join(process.cwd(), "playwright", ".auth");

export async function signIn(page: Page, account: { email: string; password: string }, role: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // A failed sign-in leaves us on /sign-in with an alert; a successful one
  // navigates away, so assert on the destination rather than a spinner.
  await expect(page).not.toHaveURL(/\/sign-in/);

  // Confirm the session is really usable rather than trusting the redirect.
  // /api/v1/account/cart is 200 only when authenticated and 401 otherwise,
  // which is a far more stable signal than any particular nav label.
  const res = await page.request.get("/api/v1/account/cart");
  expect(res.status(), `expected ${account.email} to be signed in`).toBe(200);

  mkdirSync(AUTH_DIR, { recursive: true });
  await page.context().storageState({ path: path.join(AUTH_DIR, `${role}.json`) });
}
