import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * End-to-end coverage for the seller inventory manager: CSV bulk update by
 * slug, and the selection-based action bar on /selling/listings.
 *
 * Each describe block creates its own listing through the API and deletes it
 * afterwards, so the suite is repeatable and doesn't depend on specific seeded
 * rows.
 */

type Product = { id: string; slug: string; title: string; price: number; stock: number | null };

/** Create a throwaway listing owned by the signed-in seller. */
async function createProduct(request: APIRequestContext, title: string): Promise<Product> {
  const storeEnvelope = await (await request.get("/api/v1/selling/store")).json();
  const res = await request.post("/api/v1/selling/products", {
    data: {
      storeId: storeEnvelope.data[0].id,
      title,
      description: "Created by the Playwright smoke suite.",
      image: "https://picsum.photos/seed/e2e-inventory/600",
      price: 20,
      category: "electronics",
      trackStock: true,
      stock: 100,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data;
}

async function fetchProduct(request: APIRequestContext, id: string): Promise<Product> {
  return (await (await request.get(`/api/v1/selling/products/${id}`)).json()).data;
}

/**
 * Filter the listings table down to one product.
 *
 * The search input is scoped to `main` and addressed by its aria-label on
 * purpose: the site header has its own "Search products" box with a button
 * also named "Search", and a global `getByPlaceholder(/search/i)` silently
 * drives the header, navigating to /search mid-test.
 */
async function searchListings(page: Page, title: string) {
  const main = page.getByRole("main");
  await main.getByLabel("Search my listings").fill(title);
  await main.getByLabel("Search my listings").press("Enter");
  const row = main.getByRole("row", { name: new RegExp(title) });
  await expect(row).toBeVisible();
  return row;
}

test.describe("selection action bar", () => {
  let product: Product;

  test.beforeAll(async ({ request }) => {
    product = await createProduct(request, "E2E Inventory Widget");
  });

  test.afterAll(async ({ request }) => {
    if (product) await request.delete(`/api/v1/selling/products/${product.id}`);
  });

  test("a listing can be selected and the action bar appears", async ({ page }) => {
    await page.goto("/selling/listings");
    await searchListings(page, product.title);

    // Nothing selected yet, so the bar must not be on screen.
    await expect(page.getByText(/\d+ selected/)).toHaveCount(0);

    await page.getByLabel(`Select ${product.title}`).check();
    await expect(page.getByText("1 selected")).toBeVisible();
  });

  test("a percentage markdown is a multiplier on the current price", async ({ page, request }) => {
    await page.goto("/selling/listings");
    await searchListings(page, product.title);

    const price = async () => (await fetchProduct(request, product.id)).price;
    const applyMarkdown = async () => {
      // Selection clears and the table refetches after each apply, so re-wait
      // for the row before re-selecting.
      await searchListings(page, product.title);
      await page.getByLabel(`Select ${product.title}`).check();
      await page.getByRole("button", { name: "Price", exact: true }).click();
      await page.getByLabel("Percentage change").fill("-25");
      await page.getByRole("button", { name: "Apply" }).click();
    };

    await applyMarkdown();
    await expect.poll(price).toBe(15);

    // Apply the identical markdown again. 15 * 0.75 = 11.25. Asserting on the
    // stored price rather than the toast matters: the previous toast is still
    // visible, so a toast assertion would pass even if nothing ran.
    await applyMarkdown();
    await expect.poll(price).toBe(11.25);
  });

  test("an absolute stock set is applied to the listing", async ({ page, request }) => {
    await page.goto("/selling/listings");
    await searchListings(page, product.title);

    await page.getByLabel(`Select ${product.title}`).check();
    await page.getByRole("button", { name: "Stock", exact: true }).click();
    await page.getByLabel("Set stock to").fill("42");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect.poll(async () => (await fetchProduct(request, product.id)).stock).toBe(42);
  });

  test("unpublish takes the listing to DRAFT and publish restores it", async ({ page, request }) => {
    const statusOf = async () => {
      const envelope = await (await request.get("/api/v1/selling/products?pageSize=50")).json();
      return envelope.data.find((p: { id: string }) => p.id === product.id)?.status;
    };

    await page.goto("/selling/listings");
    await searchListings(page, product.title);
    await page.getByLabel(`Select ${product.title}`).check();
    await page.getByRole("button", { name: "Unpublish", exact: true }).click();
    await page.getByRole("button", { name: "Apply" }).click();
    await expect.poll(statusOf).toBe("DRAFT");

    // Re-select and bring it back, proving the selection cleared after apply.
    await searchListings(page, product.title);
    await expect(page.getByText(/\d+ selected/)).toHaveCount(0);
    await page.getByLabel(`Select ${product.title}`).check();
    // "Publish" also substring-matches "Unpublish", so match exactly.
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Apply" }).click();
    await expect.poll(statusOf).toBe("ACTIVE");
  });

  test("select-all-on-page selects every visible listing", async ({ page }) => {
    await page.goto("/selling/listings");
    const main = page.getByRole("main");
    await expect(main.getByLabel("Select all listings on this page")).toBeVisible();
    await main.getByLabel("Select all listings on this page").check();

    const rows = await main.getByRole("row").count();
    // +1 for the header row.
    await expect(page.getByText(`${rows - 1} selected`)).toBeVisible();
  });
});

test.describe("bulk update by slug", () => {
  let product: Product;

  test.beforeAll(async ({ request }) => {
    product = await createProduct(request, "E2E Feed Widget");
  });

  test.afterAll(async ({ request }) => {
    if (product) await request.delete(`/api/v1/selling/products/${product.id}`);
  });

  test("the update tab offers its own template and a store picker", async ({ page }) => {
    await page.goto("/selling/listings/bulk");
    await page.getByRole("button", { name: /update existing/i }).click();

    await expect(page.getByRole("link", { name: /update template/i })).toHaveAttribute(
      "href",
      "/api/v1/selling/products/bulk/template-update"
    );
    await expect(page.getByLabel("Apply to store")).toBeVisible();
    await expect(page.getByLabel("CSV data")).toBeVisible();
  });

  test("updates only the columns present and explains rows it can't match", async ({ page, request }) => {
    await page.goto("/selling/listings/bulk");
    await page.getByRole("button", { name: /update existing/i }).click();

    // Only slug + price + stock. compare_at and status are absent, so they must
    // survive untouched — that's the point of column-wise updates.
    const csv = ["slug,price,stock", `${product.slug},9.5,7`, "e2e-no-such-slug,1.00,1"].join("\n");
    await page.getByLabel("CSV data").fill(csv);
    await page.getByRole("button", { name: /apply update/i }).click();

    await expect(page.getByText(/1 listing updated/)).toBeVisible();
    // The unmatched slug is reported, not silently dropped.
    await expect(page.getByText(/No product in this store has the slug/)).toBeVisible();

    const after = await fetchProduct(request, product.id);
    expect(after.price).toBe(9.5);
    expect(after.stock).toBe(7);
  });

  test("a stock value on a non-tracking listing is rejected with a reason", async ({ page, request }) => {
    // turnStock off so the row exercises the guard.
    await request.patch(`/api/v1/selling/products/${product.id}`, { data: { trackStock: false } });

    await page.goto("/selling/listings/bulk");
    await page.getByRole("button", { name: /update existing/i }).click();
    await page.getByLabel("CSV data").fill(["slug,stock", `${product.slug},500`].join("\n"));
    await page.getByRole("button", { name: /apply update/i }).click();

    await expect(page.getByText(/doesn't track stock/i)).toBeVisible();
    expect((await fetchProduct(request, product.id)).stock).not.toBe(500);
  });
});
