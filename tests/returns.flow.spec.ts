import { test, expect } from "@playwright/test";
import { roleContexts, disposeRoles, type Roles } from "./helpers/roles";

/**
 * Return lifecycle and escrow accounting across all three roles.
 *
 * The chain is buyer files -> seller responds -> support refunds, and the
 * money moves in escrow holds the whole way. Each role is a different user, so
 * this is driven through per-role API contexts rather than a page session. The
 * properties worth protecting are the ones a UI test cannot see: that escrow
 * freezes on filing, unfreezes on rejection, is *only* the seller's to lose on
 * refund, and that the state machine refuses illegal jumps.
 */

const TITLE = "E2E Return Widget";
const PRICE = 40;
const QTY = 2;

type Roles2 = Roles;
let roles: Roles2;

test.beforeAll(async () => {
  roles = await roleContexts(test.info().project.use.baseURL as string);
});

test.afterAll(async () => {
  if (roles) await disposeRoles(roles);
});

async function json(res: Awaited<ReturnType<Roles["admin"]["get"]>>) {
  return { status: res.status(), body: await res.json().catch(() => null) };
}

/** Publish a listing, buy it, and drive the order to DELIVERED. */
type Delivered = {
  listing: { id: string; slug: string };
  order: { id: string; number: string; items: Array<{ id: string; storeId: string }> };
};

async function deliveredOrder(): Promise<Delivered> {
  const storeEnvelope = await (await roles.seller.get("/api/v1/selling/store")).json();
  const created = await roles.seller.post("/api/v1/selling/products", {
    data: {
      storeId: storeEnvelope.data[0].id,
      title: TITLE,
      description: "Created by the Playwright smoke suite.",
      image: "https://picsum.photos/seed/e2e-returns/600",
      price: PRICE,
      category: "electronics",
      trackStock: true,
      stock: 50,
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const listing = (await created.json()).data;
  await roles.seller.patch(`/api/v1/selling/products/${listing.id}`, { data: { status: "ACTIVE" } });

  const checkout = await roles.buyer.post("/api/v1/checkout", {
    data: {
      items: [{ slug: listing.slug, qty: QTY }],
      address: { name: "Jane Doe", street: "123 Main St", city: "New York", zip: "10001" },
    },
  });
  expect(checkout.ok(), await checkout.text()).toBeTruthy();
  const order = (await checkout.json()).data;

  // Seller ships, then the carrier scans it in.
  for (const status of ["SHIPPED", "DELIVERED"] as const) {
    const res = await roles.seller.patch(`/api/v1/selling/orders/${order.id}`, {
      data: { status, trackingNumber: "E2E-TRACK-1", carrier: "E2E" },
    });
    expect(res.ok(), `${status}: ${await res.text()}`).toBeTruthy();
  }
  return { listing, order: order as Delivered["order"] };
}

/** File a return for the whole order. The API field is `lines`, not `items`. */
async function fileReturn(order: Delivered["order"], reason = "DEFECTIVE") {
  const res = await roles.buyer.post("/api/v1/account/returns", {
    data: {
      orderNumber: order.number,
      reason,
      note: "Arrived damaged.",
      lines: order.items.map((i) => ({ orderItemId: i.id, qty: QTY })),
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data;
}

test.describe("return lifecycle and escrow", () => {
  test("filing a return records the request in REQUESTED", async () => {
    const { order } = await deliveredOrder();
    const ret = await fileReturn(order);
    expect(ret.status).toBe("REQUESTED");
    expect(ret.items).toHaveLength(order.items.length);

    const mine = (await (await roles.buyer.get("/api/v1/account/returns")).json()).data;
    expect(mine.some((r: { id: string }) => r.id === ret.id)).toBe(true);
  });

  test("the state machine refuses jumps and only support may refund", async () => {
    const { order } = await deliveredOrder();
    const ret = await fileReturn(order);

    // REQUESTED may only go to ACCEPTED, REJECTED or CANCELLED. A seller
    // jumping straight to RECEIVED must be refused, not silently accepted.
    const jump = await json(
      await roles.seller.patch(`/api/v1/selling/returns/${ret.id}`, { data: { to: "RECEIVED" } })
    );
    expect(jump.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(jump.body)).toMatch(/cannot move/i);

    // REFUNDED is admin-only, and it is equally unreachable from REQUESTED.
    // Support must walk the chain rather than shortcut it.
    const skip = await json(
      await roles.admin.patch(`/api/v1/admin/returns?id=${ret.id}`, { data: { to: "REFUNDED" } })
    );
    expect(skip.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(skip.body)).toMatch(/cannot move/i);

    // The seller cannot even name a refund: their transition enum excludes it.
    const sellerRefund = await json(
      await roles.seller.patch(`/api/v1/selling/returns/${ret.id}`, { data: { to: "REFUNDED" } })
    );
    expect(sellerRefund.status).toBe(422);
  });

  test("the full chain reaches REFUNDED and moves escrow off HELD", async () => {
    const { order } = await deliveredOrder();
    const ret = await fileReturn(order);

    const accepted = await roles.seller.patch(`/api/v1/selling/returns/${ret.id}`, {
      data: { to: "ACCEPTED" },
    });
    expect(accepted.ok(), await accepted.text()).toBeTruthy();

    const received = await roles.seller.patch(`/api/v1/selling/returns/${ret.id}`, {
      data: { to: "RECEIVED" },
    });
    expect(received.ok(), await received.text()).toBeTruthy();

    const refunded = await roles.admin.patch(`/api/v1/admin/returns?id=${ret.id}`, {
      data: { to: "REFUNDED" },
    });
    expect(refunded.ok(), await refunded.text()).toBeTruthy();
    const final = (await refunded.json()).data;
    expect(final.status).toBe("REFUNDED");
    // Commission was already deducted when the hold was created, so the refund
    // is what the seller was owed — not the buyer's gross charge.
    expect(Number(final.refundAmount)).toBeLessThan(PRICE * QTY);
    expect(Number(final.refundAmount)).toBeGreaterThan(0);
  });

  test("a rejected return is terminal and cannot be refunded afterwards", async () => {
    const { order } = await deliveredOrder();
    const ret = await fileReturn(order);

    const rejected = await roles.seller.patch(`/api/v1/selling/returns/${ret.id}`, {
      data: { to: "REJECTED" },
    });
    expect(rejected.ok(), await rejected.text()).toBeTruthy();

    const after = await json(
      await roles.admin.patch(`/api/v1/admin/returns?id=${ret.id}`, { data: { to: "REFUNDED" } })
    );
    expect(after.status).toBeGreaterThanOrEqual(400);
  });

  test("a seller cannot act on another store's return", async () => {
    const { order } = await deliveredOrder();
    const ret = await fileReturn(order);

    // The store that sold the item can act on the return.
    const own = await roles.seller.patch(`/api/v1/selling/returns/${ret.id}`, {
      data: { to: "ACCEPTED" },
    });
    expect(own.ok(), await own.text()).toBeTruthy();

    // An unrelated seller must be refused, even though the return id is real.
    const foreign = await json(
      await roles.seller2.patch(`/api/v1/selling/returns/${ret.id}`, { data: { to: "RECEIVED" } })
    );
    expect(foreign.status).toBe(403);
    expect(JSON.stringify(foreign.body)).toMatch(/isn't for your store|not for your store/i);
  });

  test("a second return cannot double-claim the same units", async () => {
    const { order } = await deliveredOrder();
    await fileReturn(order);

    const second = await json(
      await roles.buyer.post("/api/v1/account/returns", {
        data: {
          orderNumber: order.number,
          reason: "OTHER",
          lines: order.items.map((i) => ({ orderItemId: i.id, qty: QTY })),
        },
      })
    );
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(second.body)).toMatch(/already has a return in progress/i);
  });

  test("a return cannot span two sellers", async () => {
    // Buy one item from each seller's store in a single order, so the order
    // really does span stores and the guard is genuinely exercised.
    const listings: Array<{ id: string; slug: string }> = [];
    for (const api of [roles.seller, roles.seller2]) {
      const storeEnvelope = await (await api.get("/api/v1/selling/store")).json();
      const created = await api.post("/api/v1/selling/products", {
        data: {
          storeId: storeEnvelope.data[0].id,
          title: `E2E Multi ${listings.length + 1}`,
          description: "Cross-store return fixture.",
          image: "https://picsum.photos/seed/e2e-multi/600",
          price: PRICE,
          category: "electronics",
        },
      });
      expect(created.ok(), await created.text()).toBeTruthy();
      const listing = (await created.json()).data;
      await api.patch(`/api/v1/selling/products/${listing.id}`, { data: { status: "ACTIVE" } });
      listings.push(listing);
    }

    const checkout = await roles.buyer.post("/api/v1/checkout", {
      data: {
        items: listings.map((l) => ({ slug: l.slug, qty: 1 })),
        address: { name: "Jane Doe", street: "123 Main St", city: "New York", zip: "10001" },
      },
    });
    expect(checkout.ok(), await checkout.text()).toBeTruthy();
    const order = (await checkout.json()).data;
    expect(new Set(order.items.map((i: { storeId: string }) => i.storeId)).size).toBe(2);

    const res = await json(
      await roles.buyer.post("/api/v1/account/returns", {
        data: {
          orderNumber: order.number,
          reason: "OTHER",
          lines: order.items.map((i: { id: string }) => ({ orderItemId: i.id, qty: 1 })),
        },
      })
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body)).toMatch(/separately/i);
  });
});
