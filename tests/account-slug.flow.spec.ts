import { test, expect, type Browser } from "@playwright/test";
import { roleContexts, disposeRoles, type Roles } from "./helpers/roles";

/**
 * Configurable account-section slug: the private account area lives at
 * /<slug>/* (e.g. /myebay/summary), set site-wide in Site settings.
 *
 * The money property is link integrity after a rename: every in-app and
 * notification link must follow the configured slug, and the old /account/*
 * URLs must stop resolving (clean break — no shadow section).
 */
let roles: Roles;
let browserRef: Browser;

test.beforeAll(async ({ browser }) => {
  roles = await roleContexts(test.info().project.use.baseURL as string);
  browserRef = browser;
});

test.afterAll(async () => {
  // Always restore the default slug — other specs address /account/*.
  await roles.admin.patch("/api/v1/admin/settings", { data: { site: { accountSlug: "account" } } }).catch(() => null);
  if (roles) await disposeRoles(roles);
});

async function setSlug(slug: string) {
  const res = await roles.admin.patch("/api/v1/admin/settings", { data: { site: { accountSlug: slug } } });
  return res;
}

async function buyerPage(path: string) {
  const context = await browserRef.newContext({ storageState: "playwright/.auth/buyer.json" });
  const page = await context.newPage();
  const response = await page.goto(path);
  return { context, page, response };
}

test("reserved slugs are rejected", async () => {
  for (const bad of ["store", "admin", "u"]) {
    const res = await setSlug(bad);
    expect(res.status(), `"${bad}" should be rejected`).toBe(422);
  }
  // The failed writes must not have moved the slug.
  const current = await (await roles.admin.get("/api/v1/admin/settings")).json();
  expect(current.data.site.accountSlug).toBe("account");
});

test("account section follows the configured slug, old URLs 404", async () => {
  const set = await setSlug("myebay");
  expect(set.ok(), await set.text()).toBeTruthy();

  const pub = await (await roles.buyer.get("/api/v1/settings/public")).json();
  expect(pub.data.accountSlug).toBe("myebay");

  const { context, page, response } = await buyerPage("/myebay/summary");
  try {
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /My YS/ })).toBeVisible();
    // Sidebar links follow the slug too.
    const ordersHref = await page
      .getByRole("navigation", { name: "Account activity" })
      .getByRole("link", { name: "Purchases" })
      .getAttribute("href");
    expect(ordersHref).toBe("/myebay/orders");
    // The section tab bar follows the slug as well.
    await expect(page.getByRole("tab", { name: "Messages" })).toHaveAttribute("href", "/myebay/messages");
  } finally {
    await context.close();
  }

  // Clean break: the old section no longer resolves. (Note: this app
  // serves its not-found UI with a 200 status even for unknown routes, so
  // assert on content — the legacy URL must never render account content.)
  const legacy = await buyerPage("/account/summary");
  try {
    await expect(legacy.page.getByText("Page not found")).toBeVisible();
    await expect(legacy.page.getByRole("navigation", { name: "My account" })).toHaveCount(0);
  } finally {
    await legacy.context.close();
  }
});
