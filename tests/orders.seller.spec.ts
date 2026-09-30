import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";

/**
 * Seller order fulfilment through the real UI: the orders list, its status
 * filters, and shipping an order from PAID through SHIPPED to DELIVERED.
 *
 * This is the page most likely to hide a dead control, since every button
 * here is conditional on order status and a wrong condition silently renders
 * nothing to click. The listing action bar already had exactly that bug.
 */

const TITLE = "E2E Fulfilment Widget";
const PRICE = 30;

let sellerApi: APIRequestContext;

test.beforeAll(async () => {
  sellerApi = await playwrightRequest.newContext({
    storageState: "playwright/.auth/seller.json",
    baseURL: test.info().project.use.baseURL as string,
  });
});

test.afterAll(async () => {
  if (sellerApi) await sellerApi.dispose();
});

/** Publish a listing, buy it as the buyer, and return the new order. */
async function paidOrder() {
  const storeEnvelope = await (await sellerApi.get("/api/v1/selling/store")).json();
  const created = await sellerApi.post("/api/v1/selling/products", {
    data: {
      storeId: storeEnvelope.data[0].id,
      title: TITLE,
      description: "Created by the Playwright smoke suite.",
      image: "https://picsum.photos/seed/e2e-fulfil/600",
      price: PRICE,
      category: "electronics",
      trackStock: true,
      stock: 50,
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const listing = (await created.json()).data;
  await sellerApi.patch(`/api/v1/selling/products/${listing.id}`, { data: { status: "ACTIVE" } });

  const buyer = await playwrightRequest.newContext({
    storageState: "playwright/.auth/buyer.json",
    baseURL: test.info().project.use.baseURL as string,
  });
  const checkout = await buyer.post("/api/v1/checkout", {
    data: {
      items: [{ slug: listing.slug, qty: 1 }],
      address: { name: "Jane Doe", street: "123 Main St", city: "New York", zip: "10001" },
    },
  });
  expect(checkout.ok(), await checkout.text()).toBeTruthy();
  const order = (await checkout.json()).data;
  await buyer.dispose();
  return order;
}

test.describe("seller order fulfilment", () => {
  test("the orders list shows the order and its status filter narrows it", async ({ page }) => {
    const order = await paidOrder();

    await page.goto("/selling/orders");
    const row = page.getByRole("row", { name: new RegExp(order.number) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("PAID");

    // The status pills are plain buttons; confirm they actually filter rather
    // than looking clickable.
    await page.getByRole("button", { name: "SHIPPED", exact: true }).click();
    await expect(page.getByRole("row", { name: new RegExp(order.number) })).toHaveCount(0);

    await page.getByRole("button", { name: "PAID", exact: true }).click();
    await expect(page.getByRole("row", { name: new RegExp(order.number) })).toBeVisible();
  });

  test("a PAID order offers Mark shipped and records the tracking number", async ({ page, request }) => {
    const order = await paidOrder();
    await page.goto(`/selling/orders/${order.id}`);

    const main = page.getByRole("main");
    await expect(main.getByText(order.number)).toBeVisible();
    await expect(main.getByRole("button", { name: "Mark shipped" })).toBeVisible();
    // DELIVERED is not offered before the parcel has shipped.
    await expect(main.getByRole("button", { name: "Mark delivered" })).toHaveCount(0);

    await main.getByPlaceholder("Tracking number").fill("E2E-TRACK-42");
    await main.getByPlaceholder("Carrier").fill("E2E Express");
    await main.getByRole("button", { name: "Mark shipped" }).click();

    // The tracking number must be persisted and shown back, not just accepted.
    await expect(main.getByText("E2E-TRACK-42")).toBeVisible();

    const envelope = await (await request.get(`/api/v1/selling/orders/${order.id}`)).json();
    const reloaded = envelope.data;
    expect(reloaded.status).toBe("SHIPPED");
    const shipment = reloaded.shipments.find((s: { trackingNumber: string | null }) => s.trackingNumber === "E2E-TRACK-42");
    expect(shipment, "the shipment should carry the tracking number").toBeTruthy();
    expect(shipment.carrier).toBe("E2E Express");
  });

  test("Update tracking stays disabled until a number is entered", async ({ page }) => {
    const order = await paidOrder();
    // Move it to SHIPPED so the SHIPPED-only controls render.
    await page.request.patch(`/api/v1/selling/orders/${order.id}`, {
      data: { status: "SHIPPED", trackingNumber: "E2E-SEED-1", carrier: "E2E" },
    });

    await page.goto(`/selling/orders/${order.id}`);
    const main = page.getByRole("main");
    const update = main.getByRole("button", { name: "Update tracking" });
    await expect(update).toBeVisible();
    // The field starts empty even though the shipment already has a number, so
    // the button must not be clickable until the seller types something.
    await expect(update).toBeDisabled();

    await main.getByPlaceholder("Tracking number").fill("E2E-UPDATED-2");
    await expect(update).toBeEnabled();
  });

  test("Mark delivered advances the order and retires the fulfilment form", async ({ page, request }) => {
    const order = await paidOrder();
    await page.request.patch(`/api/v1/selling/orders/${order.id}`, {
      data: { status: "SHIPPED", trackingNumber: "E2E-SEED-3", carrier: "E2E" },
    });

    await page.goto(`/selling/orders/${order.id}`);
    const main = page.getByRole("main");
    await main.getByRole("button", { name: "Mark delivered" }).click();

    // Once delivered there is nothing left to fulfil, so the whole block goes.
    await expect(main.getByRole("button", { name: "Mark delivered" })).toHaveCount(0);
    await expect(main.getByRole("button", { name: "Mark shipped" })).toHaveCount(0);
    await expect(main.getByPlaceholder("Tracking number")).toHaveCount(0);

    const envelope = await (await request.get(`/api/v1/selling/orders/${order.id}`)).json();
    expect(envelope.data.status).toBe("DELIVERED");
  });

  test("a seller cannot open another store's order", async () => {
    const order = await paidOrder();
    const seller2 = await playwrightRequest.newContext({
      storageState: "playwright/.auth/seller2.json",
      baseURL: test.info().project.use.baseURL as string,
    });
    try {
      // 404, not 403: the route filters to the seller's own items, so another
      // store's order is indistinguishable from one that does not exist. That
      // is the right answer — a 403 would confirm the order id is real.
      const res = await seller2.get(`/api/v1/selling/orders/${order.id}`);
      expect(res.status()).toBe(404);
    } finally {
      await seller2.dispose();
    }
  });
});
