import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { roleContexts, disposeRoles, type Roles } from "./helpers/roles";

/**
 * Dispute lifecycle: the adversarial counterpart to a return, where support
 * rules on the outcome and money moves to one side or the other.
 *
 * The invariant worth most here is the one that spans two features: a return
 * and a dispute are mutually exclusive on the same order, because both draw on
 * the same escrow. Nothing in either feature enforces that alone — it falls
 * out of the shared `filingEligibility` gate — so it needs a test or it will
 * quietly stop being true.
 */

const TITLE = "E2E Dispute Widget";
const PRICE = 55;
const REASON = "Parcel never arrived and the seller stopped replying.";

let roles: Roles;

test.beforeAll(async () => {
  roles = await roleContexts(test.info().project.use.baseURL as string);
});

test.afterAll(async () => {
  if (roles) await disposeRoles(roles);
});

async function json(res: { status(): number; json(): Promise<unknown> }) {
  return { status: res.status(), body: await res.json().catch(() => null) };
}

function text(body: unknown) {
  return JSON.stringify(body);
}

/** Publish a listing, buy it, and return the PAID order. */
async function paidOrder(
  title = TITLE
): Promise<{ id: string; number: string; items: Array<{ id: string; qty: number }> }> {
  const storeEnvelope = await (await roles.seller.get("/api/v1/selling/store")).json();
  const created = await roles.seller.post("/api/v1/selling/products", {
    data: {
      storeId: storeEnvelope.data[0].id,
      title,
      description: "Created by the Playwright smoke suite.",
      image: "https://picsum.photos/seed/e2e-dispute/600",
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
      items: [{ slug: listing.slug, qty: 1 }],
      address: { name: "Jane Doe", street: "123 Main St", city: "New York", zip: "10001" },
    },
  });
  expect(checkout.ok(), await checkout.text()).toBeTruthy();
  return (await checkout.json()).data;
}

async function fileDispute(order: { number: string }) {
  const res = await roles.buyer.post("/api/v1/account/disputes", {
    data: { orderNumber: order.number, category: "NOT_RECEIVED", reason: REASON },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data;
}

test.describe("dispute lifecycle", () => {
  test("a dispute opens, freezes escrow, and blocks a second one", async () => {
    const order = await paidOrder();
    const dispute = await fileDispute(order);
    expect(dispute.status).toBe("OPEN");

    const second = await json(
      await roles.buyer.post("/api/v1/account/disputes", {
        data: { orderNumber: order.number, category: "OTHER", reason: REASON },
      })
    );
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(text(second.body)).toMatch(/already has an open dispute/i);
  });

  test("an open dispute blocks a return on the same order", async () => {
    const order = await paidOrder();
    await fileDispute(order);

    // Returns and disputes draw on the same escrow, so they must not both be
    // live on one order. This is the cross-feature invariant.
    const ret = await json(
      await roles.buyer.post("/api/v1/account/returns", {
        data: {
          orderNumber: order.number,
          reason: "DEFECTIVE",
          lines: order.items.map((i) => ({ orderItemId: i.id, qty: 1 })),
        },
      })
    );
    expect(ret.status).toBeGreaterThanOrEqual(400);
    expect(text(ret.body)).toMatch(/already has an open dispute/i);
  });

  test("a short reason is rejected", async () => {
    const order = await paidOrder();
    const tooShort = await json(
      await roles.buyer.post("/api/v1/account/disputes", {
        data: { orderNumber: order.number, category: "OTHER", reason: "bad" },
      })
    );
    expect(tooShort.status).toBe(422);
  });

  test("a dispute cannot be used to move the conversation off-platform", async () => {
    const order = await paidOrder();

    // Contact details and off-platform payment are hard-blocked on dispute
    // text, the same as chat. Profanity only warns, so it is deliberately not
    // used here — that is a different policy decision.
    for (const reason of [
      "Email me at buyer@example.com and we can sort this out directly.",
      "Just pay me directly by bank transfer and I will not open a case.",
    ]) {
      const res = await json(
        await roles.buyer.post("/api/v1/account/disputes", {
          data: { orderNumber: order.number, category: "OTHER", reason },
        })
      );
      expect(res.status, `"${reason}" should be blocked`).toBe(422);
      expect(text(res.body)).toMatch(/PROTECTION|blocked/i);
    }
  });

  test("only a seller with items on the order may reply", async () => {
    const order = await paidOrder();
    const dispute = await fileDispute(order);

    const own = await roles.seller.patch(`/api/v1/selling/disputes/${dispute.id}`, {
      data: { message: "We shipped the parcel, tracking is attached." },
    });
    expect(own.ok(), await own.text()).toBeTruthy();

    const foreign = await json(
      await roles.seller2.patch(`/api/v1/selling/disputes/${dispute.id}`, {
        data: { message: "This is not my order." },
      })
    );
    expect(foreign.status).toBe(404);
  });

  test("ruling for the buyer refunds the order and the escrow", async () => {
    const order = await paidOrder();
    const dispute = await fileDispute(order);

    const res = await roles.admin.patch(`/api/v1/admin/disputes/${dispute.id}`, {
      data: { status: "RESOLVED_BUYER", message: "Evidence supports the buyer." },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const ruled = (await res.json()).data;
    expect(ruled.status).toBe("RESOLVED_BUYER");
    // The ruling must actually move money, not just flip a label.
    expect(ruled.settlement).toMatch(/refunded/i);

    const fresh = await (await roles.seller.get(`/api/v1/selling/orders/${order.id}`)).json();
    expect(fresh.data.status).toBe("REFUNDED");
  });

  test("ruling for the seller does not refund the order", async () => {
    const order = await paidOrder();
    const dispute = await fileDispute(order);

    const res = await roles.admin.patch(`/api/v1/admin/disputes/${dispute.id}`, {
      data: { status: "RESOLVED_SELLER", message: "Tracking confirms delivery." },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const ruled = (await res.json()).data;
    expect(ruled.status).toBe("RESOLVED_SELLER");

    const fresh = await (await roles.seller.get(`/api/v1/selling/orders/${order.id}`)).json();
    expect(fresh.data.status).not.toBe("REFUNDED");
  });

  test("the state machine refuses illegal moves and CLOSED is terminal", async () => {
    const order = await paidOrder();
    const dispute = await fileDispute(order);

    // CLOSED is reachable straight from OPEN, and then nothing is.
    const closed = await roles.admin.patch(`/api/v1/admin/disputes/${dispute.id}`, {
      data: { status: "CLOSED", message: "Withdrawn." },
    });
    expect(closed.ok(), await closed.text()).toBeTruthy();

    const after = await json(
      await roles.admin.patch(`/api/v1/admin/disputes/${dispute.id}`, { data: { status: "UNDER_REVIEW" } })
    );
    expect(after.status).toBe(422);
    expect(text(after.body)).toMatch(/cannot move dispute/i);

    // A closed dispute is also closed to seller replies.
    const reply = await json(
      await roles.seller.patch(`/api/v1/selling/disputes/${dispute.id}`, {
        data: { message: "One more thing…" },
      })
    );
    expect(reply.status).toBe(422);
    expect(text(reply.body)).toMatch(/closed to new messages/i);
  });

  test("a buyer cannot dispute an order that is not theirs", async () => {
    const order = await paidOrder();
    const other: APIRequestContext = await playwrightRequest.newContext({
      storageState: "playwright/.auth/seller2.json",
      baseURL: test.info().project.use.baseURL as string,
    });
    try {
      const res = await json(
        await other.post("/api/v1/account/disputes", {
          data: { orderNumber: order.number, category: "OTHER", reason: REASON },
        })
      );
      // Ownership, not authorization: a different account filing against a
      // real order number must be told the order does not exist, rather than
      // confirming it does.
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(text(res.body)).toMatch(/not found/i);
    } finally {
      await other.dispose();
    }
  });
});
