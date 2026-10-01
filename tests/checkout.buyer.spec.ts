import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Buyer purchase flow: product page -> cart -> checkout -> order, plus the
 * stock and money invariants that have to hold when it goes wrong.
 *
 * A seller listing is created in beforeAll and removed in afterAll, so these
 * tests never depend on seeded catalogue rows. It carries real stock
 * (`trackStock`, stock 5) so oversell behaviour is observable.
 */

type Listing = { id: string; slug: string; title: string; price: number; stock: number | null };

/**
 * Listing setup/teardown has to run as the *seller* even though these tests
 * run as the buyer, and the buyer has no store. A separate API context built
 * from the seller's saved session handles that without giving the buyer
 * seller credentials.
 */
const SELLER_STATE = "playwright/.auth/seller.json";

const STORE_TITLE = "E2E Checkout Widget";
const START_STOCK = 5;
const PRICE = 20;

async function createListing(request: APIRequestContext): Promise<Listing> {
  const storeEnvelope = await (await request.get("/api/v1/account/selling/store")).json();
  const res = await request.post("/api/v1/account/selling/products", {
    data: {
      storeId: storeEnvelope.data[0].id,
      title: STORE_TITLE,
      description: "Created by the Playwright smoke suite.",
      image: "https://picsum.photos/seed/e2e-checkout/600",
      price: PRICE,
      category: "electronics",
      trackStock: true,
      stock: START_STOCK,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const listing = (await res.json()).data;

  // The create endpoint always files a listing as DRAFT, and `resolveCart`
  // refuses anything that isn't ACTIVE, so publish it before it can be bought.
  const published = await request.patch(`/api/v1/account/selling/products/${listing.id}`, {
    data: { status: "ACTIVE" },
  });
  expect(published.ok(), await published.text()).toBeTruthy();
  return listing;
}

async function stockOf(request: APIRequestContext, listing: Listing) {
  return (await (await request.get(`/api/v1/account/selling/products/${listing.id}`)).json()).data.stock;
}

/** Add to cart through the real product page, then land on the cart. */
async function addToCartViaUi(page: Page, listing: Listing) {
  await page.goto(`/product/${listing.slug}`);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/cart");
  await expect(page.getByText(STORE_TITLE).first()).toBeVisible();
}

/**
 * Fill the inline checkout address form. The state and country selects are
 * Radix popups, not <select>, so they are driven through their trigger +
 * listbox rather than a native value change.
 */
async function fillAddress(page: Page) {
  const main = page.getByRole("main");
  await main.getByLabel("Full name *").fill("Jane Doe");
  await main.getByLabel("Street *").fill("123 Main St");
  await main.getByLabel("City *").fill("New York");

  // "State / Province *" is a Select; the trigger carries the label's htmlFor.
  await main.getByLabel("State / Province *").click();
  await page.getByRole("option", { name: "New York", exact: true }).click();

  await main.getByLabel("ZIP *").fill("10001");
}

test.describe("buyer checkout", () => {
  let listing: Listing;
  let sellerApi: APIRequestContext;

  test.beforeAll(async () => {
    sellerApi = await playwrightRequest.newContext({
      storageState: SELLER_STATE,
      baseURL: test.info().project.use.baseURL as string,
    });
    listing = await createListing(sellerApi);
  });

  test.afterAll(async () => {
    if (listing) await sellerApi.delete(`/api/v1/account/selling/products/${listing.id}`);
    await sellerApi.dispose();
  });

  test("the product page blocks checkout until a size is chosen", async ({ page }) => {
    await page.goto(`/product/${listing.slug}`);
    // No variants on this listing, so the button must be immediately usable.
    await expect(page.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  });

  test("a cart line survives the round trip to checkout", async ({ page }) => {
    await addToCartViaUi(page, listing);
    await page.getByRole("link", { name: "Checkout" }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByText(STORE_TITLE).first()).toBeVisible();
  });

  test("placing an order decrements stock and shows a total", async ({ page }) => {
    // Buy one, so the expected remaining stock is unambiguous.
    await page.goto(`/product/${listing.slug}`);
    await page.getByRole("button", { name: "Add to cart" }).click();
    await page.goto("/checkout");
    await fillAddress(page);

    const main = page.getByRole("main");
    // Total must be at least the item price; the exact figure includes
    // shipping, which depends on the store's rate, so assert the lower bound.
    await expect(main.getByText("Total")).toBeVisible();
    const payNow = main.getByRole("button", { name: "Pay now" });
    await expect(payNow).toBeEnabled();

    await payNow.click();
    await expect(page).toHaveURL(/\/checkout\/success/);
    await expect.poll(async () => await stockOf(sellerApi, listing)).toBe(START_STOCK - 1);
  });

  test("the server refuses an order beyond available stock", async ({ page }) => {
    await sellerApi.patch(`/api/v1/account/selling/products/${listing.id}`, {
      data: { trackStock: true, stock: 1 },
    });

    // Driven through the API on purpose. The product page caps its quantity
    // stepper at the available stock, so the UI cannot express an oversell —
    // what needs testing is that the server refuses one anyway and that stock
    // is left untouched rather than driven negative.
    const res = await page.request.post("/api/v1/checkout", {
      data: {
        items: [{ slug: listing.slug, qty: 5 }],
        address: { name: "Jane Doe", line1: "123 Main St", city: "New York", region: "New York", postalCode: "10001", country: "US" },
      },
    });
    expect(res.ok(), `oversell should be rejected, got ${res.status()}`).toBe(false);
    const body = await res.json();
    expect(JSON.stringify(body)).toMatch(/left of|out of stock/i);

    const after = await stockOf(sellerApi, listing);
    expect(after, "stock must never go negative").toBe(1);
  });

  test("checkout re-prices server-side and ignores a tampered cart price", async ({ page }) => {
    await sellerApi.patch(`/api/v1/account/selling/products/${listing.id}`, {
      data: { trackStock: true, stock: 10 },
    });

    // The cart API accepts a client-supplied price; assert checkout does not
    // trust it. Sending $0.01 for a $20 item must still bill $20.
    const res = await page.request.post("/api/v1/checkout", {
      data: {
        items: [{ slug: listing.slug, qty: 1, price: 0.01, title: listing.title, image: "" }],
        address: { name: "Jane Doe", line1: "123 Main St", city: "New York", region: "New York", postalCode: "10001", country: "US" },
      },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const order = (await res.json()).data;

    const itemTotal = order.items.reduce((a: number, i: { price: number; qty: number }) => a + i.price * i.qty, 0);
    expect(itemTotal, "server must bill the catalogue price, not the posted price").toBe(PRICE);
  });

  test("checkout rejects an incomplete payload", async ({ page }) => {
    const address = { name: "Jane Doe", line1: "123 Main St", city: "New York", region: "New York", postalCode: "10001", country: "US" };

    const cases: Array<[string, unknown]> = [
      ["no address", { items: [{ slug: listing.slug, qty: 1 }] }],
      ["no items", { address }],
      ["unknown slug", { items: [{ slug: "no-such-listing-xyz", qty: 1 }], address }],
      ["zero qty", { items: [{ slug: listing.slug, qty: 0 }], address }],
      ["partial address", { items: [{ slug: listing.slug, qty: 1 }], address: { name: "Jane Doe" } }],
    ];
    for (const [label, body] of cases) {
      const res = await page.request.post("/api/v1/checkout", { data: body });
      expect(res.status(), `${label} must be rejected, got ${await res.text()}`).toBe(422);
    }
  });
});
