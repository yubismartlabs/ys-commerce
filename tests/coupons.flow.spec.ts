import { test, expect } from "@playwright/test";
import { roleContexts, disposeRoles, type Roles } from "./helpers/roles";

/**
 * Coupon application at checkout.
 *
 * The money property worth protecting is the store-scoped FREESHIP coupon: a
 * buyer's code may only waive the shipping for the seller's own parcels. If it
 * waived everything, the platform would have to reimburse a stranger's
 * delivery fee — the seller would be paid less than they shipped for. That is
 * a subtle, cross-store calculation, so it is asserted directly against a
 * two-store basket rather than inferred.
 */

const PRICE = 15; // Below the $25 free-shipping threshold, so shipping is a real fee.
let roles: Roles;

test.beforeAll(async () => {
  roles = await roleContexts(test.info().project.use.baseURL as string);
});

test.afterAll(async () => {
  if (roles) await disposeRoles(roles);
});

type Store = { id: string; name: string };

async function storeOf(role: "seller" | "seller2"): Promise<Store> {
  const envelope = await (await roles[role].get("/api/v1/selling/store")).json();
  return envelope.data[0];
}

let seq = 0;
/** Unique per run, and unique even if the database somehow survives one. */
function uniqueCode(prefix: string) {
  seq += 1;
  return `${prefix}${seq}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
type Fixture = {
  id: string;
  slug: string;
  owner: "seller" | "seller2";
  storeId: string;
  storeName: string;
};

/** Publish a listing for the given seller, priced so shipping is charged. */
async function listing(role: "seller" | "seller2", price = PRICE): Promise<Fixture> {
  const store = await storeOf(role);
  const created = await roles[role].post("/api/v1/selling/products", {
    data: {
      storeId: store.id,
      title: `E2E Coupon ${role} ${uniqueCode("P")}`,
      description: "Created by the Playwright smoke suite.",
      image: "https://picsum.photos/seed/e2e-coupon/600",
      price,
      category: "electronics",
      freeShipping: false,
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const p = (await created.json()).data;
  await roles[role].patch(`/api/v1/selling/products/${p.id}`, { data: { status: "ACTIVE" } });
  // Built field by field rather than spread: spreading an `any` collapses the
  // return type to `any` and silently disables checking at every call site.
  return { id: p.id, slug: p.slug, owner: role, storeId: store.id, storeName: store.name };
}

async function makeCoupon(body: Record<string, unknown>) {
  const res = await roles.admin.post("/api/v1/admin/coupons", {
    data: { code: uniqueCode("E2ECPN"), active: true, ...body },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data;
}

type Order = { id: string; number: string; total: number; subtotal: number; discount: number; shipping: number };

async function buy(items: Array<{ slug: string; qty?: number }>, couponCode?: string): Promise<Order> {
  const res = await roles.buyer.post("/api/v1/checkout", {
    data: {
      items: items.map((i) => ({ slug: i.slug, qty: i.qty ?? 1 })),
      ...(couponCode ? { couponCode } : {}),
      address: { name: "Jane Doe", street: "123 Main St", city: "New York", zip: "10001" },
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const o = (await res.json()).data;
  return { id: o.id, number: o.number, total: Number(o.total), subtotal: Number(o.subtotal), discount: Number(o.discount), shipping: Number(o.shipping) };
}

test.describe("coupons at checkout", () => {
  test("a percentage coupon discounts the order and is recorded", async () => {
    const item = await listing("seller");
    const coupon = await makeCoupon({ type: "PERCENT", pctOff: 10 });
    const order = await buy([{ slug: item.slug }], coupon.code);

    expect(order.discount).toBeCloseTo(PRICE * 0.1, 2);
    expect(order.total).toBeCloseTo(order.subtotal - order.discount + order.shipping, 2);

    const refreshed = await (await roles.admin.get("/api/v1/admin/coupons")).json();
    const row = (refreshed.data ?? refreshed.coupons).find((c: { code: string }) => c.code === coupon.code);
    expect(row.usedCount).toBe(1);
  });

  test("a fixed coupon cannot exceed the subtotal, and the total never goes negative", async () => {
    const item = await listing("seller", 10);
    const coupon = await makeCoupon({ type: "FIXED", amountOff: 500 });
    const order = await buy([{ slug: item.slug }], coupon.code);

    expect(order.discount).toBeLessThanOrEqual(order.subtotal);
    expect(order.discount).toBe(10);
    expect(order.total).toBeGreaterThanOrEqual(0);
  });

  test("a minimum-subtotal coupon is refused below the threshold", async () => {
    const cheap = await listing("seller", 10);
    const coupon = await makeCoupon({ type: "FIXED", amountOff: 5, minSubtotal: 100 });

    const res = await roles.buyer.post("/api/v1/checkout", {
      data: {
        items: [{ slug: cheap.slug, qty: 1 }],
        couponCode: coupon.code,
        address: { name: "Jane Doe", street: "123 Main St", city: "New York", zip: "10001" },
      },
    });
    expect(res.status()).toBe(422);
    expect(JSON.stringify(await res.json())).toMatch(/eligible subtotal/i);
  });

  test("a store-scoped FREESHIP coupon waives only that store's shipping", async () => {
    const mine = await listing("seller");
    const theirs = await listing("seller2");

    // Baseline: what both parcels cost with no coupon.
    const baseline = await buy([{ slug: mine.slug }, { slug: theirs.slug }]);
    expect(baseline.shipping).toBeCloseTo(1.99 * 2, 2);

    const a = await listing("seller");
    const b = await listing("seller2");
    const coupon = await makeCoupon({ type: "FREESHIP", storeIds: [mine.storeId] });
    const order = await buy([{ slug: a.slug }, { slug: b.slug }], coupon.code);

    // Exactly one parcel's fee is waived; the stranger's is still charged.
    expect(order.discount).toBe(0);
    expect(order.shipping).toBeCloseTo(1.99, 2);
    expect(order.total).toBeCloseTo(order.subtotal + 1.99, 2);
  });

  test("a platform-wide FREESHIP coupon waives every parcel", async () => {
    const a = await listing("seller");
    const b = await listing("seller2");
    const coupon = await makeCoupon({ type: "FREESHIP" });
    const order = await buy([{ slug: a.slug }, { slug: b.slug }], coupon.code);
    expect(order.shipping).toBe(0);
    expect(order.total).toBeCloseTo(order.subtotal, 2);
  });

  test("a category-scoped coupon ignores ineligible items", async () => {
    const scoped = await listing("seller");
    const other = await listing("seller2");
    // Patch with the owning session: seller1 cannot touch a seller2 listing,
    // so using the wrong role here would leave the category unchanged and the
    // assertion below would silently measure the wrong thing.
    await roles[other.owner].patch(`/api/v1/selling/products/${other.id}`, {
      data: { category: "home" },
    });
    const reloaded = await (await roles[other.owner].get(`/api/v1/selling/products/${other.id}`)).json();
    expect(reloaded.data.category).toBe("home");

    const coupon = await makeCoupon({ type: "PERCENT", pctOff: 50, categories: ["electronics"] });
    // Only the electronics item counts toward the discount.
    const order = await buy([{ slug: scoped.slug }, { slug: other.slug }], coupon.code);
    expect(order.discount).toBeCloseTo(PRICE * 0.5, 2);
  });

  test("a per-user limit is enforced on the second use", async () => {
    const item = await listing("seller");
    const coupon = await makeCoupon({ type: "PERCENT", pctOff: 5, perUserLimit: 1 });

    await buy([{ slug: item.slug }], coupon.code);
    const second = await listing("seller");
    const res = await roles.buyer.post("/api/v1/checkout", {
      data: {
        items: [{ slug: second.slug, qty: 1 }],
        couponCode: coupon.code,
        address: { name: "Jane Doe", street: "123 Main St", city: "New York", zip: "10001" },
      },
    });
    expect(res.status()).toBe(422);
    expect(JSON.stringify(await res.json())).toMatch(/already used this code/i);
  });

  test("an unknown or inactive code is refused with a reason", async () => {
    const item = await listing("seller");
    const body = {
      items: [{ slug: item.slug, qty: 1 }],
      address: { name: "Jane Doe", street: "123 Main St", city: "New York", zip: "10001" },
    };

    const unknown = await roles.buyer.post("/api/v1/checkout", { data: { ...body, couponCode: "NOPE-NOT-A-CODE" } });
    expect(unknown.status()).toBe(422);
    expect(JSON.stringify(await unknown.json())).toMatch(/doesn't exist/i);

    const inactive = await makeCoupon({ type: "PERCENT", pctOff: 5, active: false });
    const off = await roles.buyer.post("/api/v1/checkout", { data: { ...body, couponCode: inactive.code } });
    expect(off.status()).toBe(422);
    expect(JSON.stringify(await off.json())).toMatch(/no longer active/i);
  });
});
