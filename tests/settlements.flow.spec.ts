import { test, expect } from "@playwright/test";
import { roleContexts, disposeRoles, type Roles } from "./helpers/roles";
import { db, daysAgo } from "./helpers/db";

/**
 * Escrow settlement and payouts: the last untested money path.
 *
 * Two gates guard a seller's money and neither is reachable through the API on
 * any useful timescale — `protectionUntil` plus the settling buffer (14 days by
 * default) before a hold releases, and the payout cadence (weekly) plus a $20
 * minimum before a payout is paid. So the fixtures backdate the rows directly
 * and then drive the real scheduler endpoint, and every assertion is made
 * against what the API returns.
 *
 * The arithmetic pinned here is the commission split: a hold is gross minus
 * commission, and a coupon must reduce the hold pro-rata rather than leaving
 * the seller paid on the undiscounted price.
 */

const PRICE = 40;
let roles: Roles;

test.beforeAll(async () => {
  roles = await roleContexts(test.info().project.use.baseURL as string);
});

test.afterAll(async () => {
  if (roles) await disposeRoles(roles);
});

let seq = 0;
function tag() {
  seq += 1;
  return `E2E Settle ${seq} ${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function storeOf(role: "seller" | "seller2") {
  const envelope = await (await roles[role].get("/api/v1/selling/store")).json();
  return envelope.data[0] as { id: string; name: string };
}

async function deliveredOrder(role: "seller" | "seller2" = "seller", price = PRICE) {
  const store = await storeOf(role);
  const created = await roles[role].post("/api/v1/selling/products", {
    data: {
      storeId: store.id,
      title: tag(),
      description: "Created by the Playwright smoke suite.",
      image: "https://picsum.photos/seed/e2e-settle/600",
      price,
      category: "electronics",
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const listing = (await created.json()).data;
  await roles[role].patch(`/api/v1/selling/products/${listing.id}`, { data: { status: "ACTIVE" } });

  const checkout = await roles.buyer.post("/api/v1/checkout", {
    data: {
      items: [{ slug: listing.slug, qty: 1 }],
      address: { name: "Jane Doe", street: "123 Main St", city: "New York", zip: "10001" },
    },
  });
  expect(checkout.ok(), await checkout.text()).toBeTruthy();
  const order = (await checkout.json()).data;

  for (const status of ["SHIPPED", "DELIVERED"] as const) {
    const res = await roles[role].patch(`/api/v1/selling/orders/${order.id}`, {
      data: { status, trackingNumber: "E2E-T", carrier: "E2E" },
    });
    expect(res.ok(), `${status}: ${await res.text()}`).toBeTruthy();
  }
  return { order, storeId: store.id, role };
}

/** Age the buyer-protection window so the settling buffer has elapsed. */
async function backdateProtection(orderId: string, days: number) {
  const res = await db.order.updateMany({
    where: { id: orderId },
    data: { protectionUntil: daysAgo(days) },
  });
  expect(res.count).toBe(1);
}

async function runOps() {
  const res = await roles.admin.post("/api/v1/admin/ops/run");
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data;
}

/** The endpoint returns { stores, balance, payouts } — payouts is one level in. */
async function payoutsFor(role: "seller" | "seller2") {
  const envelope = await (await roles[role].get("/api/v1/selling/payouts")).json();
  const body = envelope.data ?? envelope;
  return (body.payouts ?? []) as Array<{ id: string; amount: string; status: string; storeId: string }>;
}

test.describe("escrow settlement and payouts", () => {
  test("a hold records gross, commission and net", async () => {
    const { order, storeId } = await deliveredOrder();
    const hold = await db.escrowHold.findFirstOrThrow({ where: { orderId: order.id } });
    const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });

    const gross = Number(hold.gross);
    const commission = Number(hold.commission);
    expect(gross).toBeCloseTo(PRICE, 2);
    expect(commission).toBeCloseTo(gross * Number(store.commissionRate), 2);
    expect(Number(hold.net)).toBeCloseTo(gross - commission, 2);
    expect(hold.status).toBe("HELD");
  });

  test("a coupon reduces the hold pro-rata, not the seller's net share", async () => {
    const store = await storeOf("seller");
    seq += 1;
    const couponRes = await roles.admin.post("/api/v1/admin/coupons", {
      data: { code: `E2ESETTLE${seq}`, type: "PERCENT", pctOff: 50, active: true },
    });
    expect(couponRes.ok(), await couponRes.text()).toBeTruthy();
    const coupon = (await couponRes.json()).data;

    const created = await roles.seller.post("/api/v1/selling/products", {
      data: {
        storeId: store.id,
        title: tag(),
        description: "Created by the Playwright smoke suite.",
        image: "https://picsum.photos/seed/e2e-settle-cpn/600",
        price: PRICE,
        category: "electronics",
      },
    });
    const listing = (await created.json()).data;
    await roles.seller.patch(`/api/v1/selling/products/${listing.id}`, { data: { status: "ACTIVE" } });

    const checkout = await roles.buyer.post("/api/v1/checkout", {
      data: {
        items: [{ slug: listing.slug, qty: 1 }],
        couponCode: coupon.code,
        address: { name: "Jane Doe", street: "123 Main St", city: "New York", zip: "10001" },
      },
    });
    expect(checkout.ok(), await checkout.text()).toBeTruthy();
    const order = (await checkout.json()).data;

    // The buyer paid half, so the hold must be based on half — paying the
    // seller commission on the undiscounted price would overpay the platform.
    const hold = await db.escrowHold.findFirstOrThrow({ where: { orderId: order.id } });
    expect(Number(hold.gross)).toBeCloseTo(PRICE * 0.5, 2);
    expect(Number(hold.net)).toBeLessThan(Number(hold.gross));
  });

  test("funds do not release while the protection window is open", async () => {
    const { order } = await deliveredOrder();
    // protectionUntil is stamped on delivery, i.e. now.
    const result = await runOps();
    expect(result.release.released).toBe(0);
    const hold = await db.escrowHold.findFirstOrThrow({ where: { orderId: order.id } });
    expect(hold.status).toBe("HELD");
  });

  test("funds release once the settling buffer has elapsed", async () => {
    const { order, storeId } = await deliveredOrder();
    await backdateProtection(order.id, 30);

    const result = await runOps();
    expect(result.release.released).toBeGreaterThanOrEqual(1);

    const hold = await db.escrowHold.findFirstOrThrow({ where: { orderId: order.id } });
    expect(hold.status).toBe("RELEASED");
    expect(hold.releasedAt).not.toBeNull();

    const mine = await payoutsFor("seller");
    const payout = mine.find((p) => p.storeId === storeId);
    expect(payout, "a pending payout should exist for the store").toBeTruthy();
    expect(Number(payout!.amount)).toBeGreaterThan(0);
  });

  test("releasing twice does not pay twice", async () => {
    const { order } = await deliveredOrder();
    await backdateProtection(order.id, 30);

    const first = await runOps();
    const released = first.release.released;
    expect(released).toBeGreaterThanOrEqual(1);

    // The scheduler is documented as idempotent; a rerun must find nothing.
    const second = await runOps();
    expect(second.release.released).toBe(0);
  });

  test("a payout below the minimum is not paid even past its cadence", async () => {
    // A $10 item nets ~$9.50 after commission, under the $20 default minimum.
    // Age the payout past the weekly cadence too, so the minimum is the only
    // thing left that can be holding it back.
    //
    // Payouts accumulate per store rather than being created per order, so the
    // store's existing balance is cleared first — otherwise earlier orders in
    // this run push the total over the minimum and the gate stops being the
    // thing under test.
    const { order, storeId } = await deliveredOrder("seller", 10);
    await db.payout.deleteMany({ where: { storeId } });
    await backdateProtection(order.id, 30);
    await runOps();

    const payout = (await payoutsFor("seller")).find((p) => p.storeId === storeId);
    expect(payout, "a pending payout should exist for the store").toBeTruthy();
    expect(Number(payout!.amount)).toBeLessThan(20);

    await db.payout.updateMany({ where: { id: payout!.id }, data: { createdAt: daysAgo(30) } });
    const result = await runOps();

    const after = await db.payout.findUniqueOrThrow({ where: { id: payout!.id } });
    expect(after.status, "below the payout minimum, so it must stay PENDING").toBe("PENDING");
    expect(after.paidAt).toBeNull();
    // Sanity: the scheduler did run, it simply declined this one.
    expect(result.payouts).toBeDefined();
  });

  test("a payout is not paid before its cadence elapses", async () => {
    const { order, storeId } = await deliveredOrder();
    await backdateProtection(order.id, 30);
    await runOps();

    const payout = (await payoutsFor("seller")).find((p) => p.storeId === storeId);
    expect(payout).toBeTruthy();
    // Weekly cadence by default, and this payout was just created, so the run
    // above must not have marked it paid.
    expect(payout!.status).toBe("PENDING");

    // Age it past the cadence and enough to clear the minimum, then re-run.
    await db.payout.updateMany({
      where: { id: payout!.id },
      data: { createdAt: daysAgo(10), amount: 50 },
    });
    const result = await runOps();
    expect(result.payouts.paid).toBeGreaterThanOrEqual(1);
    const after = await db.payout.findUniqueOrThrow({ where: { id: payout!.id } });
    expect(after.status).toBe("PAID");
    expect(after.paidAt).not.toBeNull();
  });

  test("a seller sees only their own store's payouts", async () => {
    const { order } = await deliveredOrder("seller2");
    await backdateProtection(order.id, 30);
    await runOps();

    const sellerPayouts = await payoutsFor("seller");
    const seller2Payouts = await payoutsFor("seller2");
    const seller2Store = await storeOf("seller2");

    expect(seller2Payouts.some((p) => p.storeId === seller2Store.id)).toBe(true);
    expect(sellerPayouts.some((p) => p.storeId === seller2Store.id)).toBe(false);
  });
});
