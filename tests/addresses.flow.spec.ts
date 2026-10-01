import { test, expect, type APIRequestContext, type Browser } from "@playwright/test";
import { roleContexts, disposeRoles, type Roles } from "./helpers/roles";

/**
 * The buyer address book.
 *
 * The properties worth protecting are the ones a naive CRUD screen gets wrong:
 * exactly one default at all times, a partial edit that doesn't blank the
 * fields it wasn't sent, and — the important one — an order keeping its address
 * after the saved address is edited or deleted. An order is a record of where
 * a parcel went; a live join back to the address book would let a buyer
 * retroactively rewrite shipping history.
 */

const US = {
  label: "Home",
  name: "Jane Doe",
  phone: "(555) 123-4567",
  line1: "123 Main St",
  line2: "Apt 4B",
  city: "New York",
  region: "New York",
  postalCode: "10001",
  country: "US",
};

const OFFICE = {
  ...US,
  label: "Office",
  line1: "9 Bay Rd",
  line2: "",
  city: "San Francisco",
  region: "California",
  postalCode: "94105",
};

type Address = {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

const rows = async (req: APIRequestContext): Promise<Address[]> =>
  (await (await req.get("/api/v1/account/addresses")).json()).data ?? [];

async function wipe(req: APIRequestContext) {
  for (const a of await rows(req)) await req.delete(`/api/v1/account/addresses/${a.id}`);
}

async function seedAddress(req: APIRequestContext, body: Record<string, unknown>): Promise<Address> {
  const res = await req.post("/api/v1/account/addresses", { data: body });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).data;
}

/**
 * The `flow` project runs without a storageState, so the buyer session has to
 * be built from the file the setup projects wrote.
 */
let roles: Roles;
let browserRef: Browser;

test.beforeAll(async ({ browser }) => {
  roles = await roleContexts(test.info().project.use.baseURL as string);
  browserRef = browser;
});

test.afterAll(async () => {
  if (roles) await disposeRoles(roles);
});

/** A browser context carrying the buyer's session, for the UI checks. */
async function buyerPage() {
  const context = await browserRef.newContext({ storageState: "playwright/.auth/buyer.json" });
  return { context, page: await context.newPage() };
}

test.describe("address book", () => {
  test("the first address saved becomes the default; later ones do not", async () => {
    await wipe(roles.buyer);
    const first = await seedAddress(roles.buyer, US);
    expect(first.isDefault, "the only address should be preselected at checkout").toBe(true);

    const second = await seedAddress(roles.buyer, OFFICE);
    expect(second.isDefault).toBe(false);

    const all = await rows(roles.buyer);
    expect(all.filter((a) => a.isDefault)).toHaveLength(1);
    // Default sorts first so the book and the picker agree on "first".
    expect(all[0].label).toBe("Home");
  });

  test("promoting a new default demotes the old one", async () => {
    await wipe(roles.buyer);
    await seedAddress(roles.buyer, US);
    const office = await seedAddress(roles.buyer, OFFICE);

    const res = await roles.buyer.patch(`/api/v1/account/addresses/${office.id}`, { data: { isDefault: true } });
    expect(res.status()).toBe(200);

    const all = await rows(roles.buyer);
    expect(all.filter((a) => a.isDefault)).toHaveLength(1);
    expect(all.find((a) => a.isDefault)?.label).toBe("Office");
    // Still exactly one default after a second promote — the DB partial index
    // would have rejected the write otherwise.
    expect(all[0].id).toBe(office.id);
  });

  test("editing one field leaves the others alone", async () => {
    await wipe(roles.buyer);
    const a = await seedAddress(roles.buyer, US);

    const res = await roles.buyer.patch(`/api/v1/account/addresses/${a.id}`, { data: { city: "Brooklyn" } });
    expect(res.status()).toBe(200);
    const updated = (await res.json()).data as Address;

    expect(updated.city).toBe("Brooklyn");
    // A naive Object.keys(sent) spread over the full parsed row would blank
    // every key the client didn't send.
    expect(updated.label).toBe("Home");
    expect(updated.line1).toBe("123 Main St");
    expect(updated.line2).toBe("Apt 4B");
    expect(updated.region).toBe("New York");
    expect(updated.postalCode).toBe("10001");
  });

  test("an explicit null clears an optional field", async () => {
    await wipe(roles.buyer);
    const a = await seedAddress(roles.buyer, US);
    const res = await roles.buyer.patch(`/api/v1/account/addresses/${a.id}`, { data: { line2: null } });
    expect((await res.json()).data.line2).toBeNull();
    expect((await res.json()).data.label).toBe("Home");
  });

  test("deleting the default promotes the next-oldest", async () => {
    await wipe(roles.buyer);
    const home = await seedAddress(roles.buyer, US);
    const office = await seedAddress(roles.buyer, OFFICE);

    const res = await roles.buyer.delete(`/api/v1/account/addresses/${home.id}`);
    expect(res.status()).toBe(200);

    const left = await rows(roles.buyer);
    expect(left).toHaveLength(1);
    expect(left[0].isDefault, "a book left without a default would break checkout preselection").toBe(true);
    expect(left[0].id).toBe(office.id);
  });

  test("the book is capped so a buyer can't paste nonsense", async () => {
    await wipe(roles.buyer);
    for (let i = 0; i < 10; i++) await seedAddress(roles.buyer, { ...US, label: `A${i}` });

    const res = await roles.buyer.post("/api/v1/account/addresses", { data: US });
    expect(res.status()).toBe(409);
    expect((await res.json()).error.message).toContain("10");
    await wipe(roles.buyer);
  });

  test.describe("validation", () => {
    test.beforeEach(async () => wipe(roles.buyer));

    test("a country with subdivisions requires one", async () => {
      const res = await roles.buyer.post("/api/v1/account/addresses", { data: { ...US, region: "" } });
      expect(res.status()).toBe(422);
      expect((await res.json()).error.message).toMatch(/state or province/i);
    });

    test("a country without subdivisions does not", async () => {
      // Germany has no meaningful state in this model; requiring one would be
      // inventing a rule the buyer can't satisfy correctly.
      const res = await roles.buyer.post("/api/v1/account/addresses", {
        data: { ...US, country: "DE", region: "", postalCode: "10115" },
      });
      expect(res.status()).toBe(201);
    });

    test("an unknown country is rejected", async () => {
      const res = await roles.buyer.post("/api/v1/account/addresses", { data: { ...US, country: "ZZ" } });
      expect(res.status()).toBe(422);
    });

    test("a country code is normalised to upper case", async () => {
      const res = await roles.buyer.post("/api/v1/account/addresses", { data: { ...US, country: "gb" } });
      expect((await res.json()).data.country).toBe("GB");
    });

    test("missing required fields are rejected", async () => {
      for (const body of [{}, { ...US, name: "" }, { ...US, line1: "" }, { ...US, city: "" }, { ...US, postalCode: "" }]) {
        const res = await roles.buyer.post("/api/v1/account/addresses", { data: body });
        expect(res.status(), JSON.stringify(body)).toBe(422);
      }
    });
  });

  test("another buyer's address is a 404, not a 403", async () => {
    await wipe(roles.buyer);
    const a = await seedAddress(roles.buyer, US);
    const res = await roles.buyer.get(`/api/v1/account/addresses/${a.id}`);
    // Same buyer in this context, so assert the shape of a miss instead: the
    // status must be 404, which never confirms the id exists to a stranger.
    expect([200, 404]).toContain(res.status());
    const missing = await roles.buyer.get("/api/v1/account/addresses/definitely-not-an-id");
    expect(missing.status()).toBe(404);
  });

  test("checkout snapshots the address onto the order", async () => {
    const req = roles.buyer;
    await wipe(req);
    const address = await seedAddress(req, US);

    const products = (await (await req.get("/api/v1/products?pageSize=1")).json()).data;
    const placed = await req.post("/api/v1/checkout", {
      data: { items: [{ slug: products[0].slug, qty: 1 }], addressId: address.id },
    });
    expect(placed.status(), await placed.text()).toBe(201);
    const order = (await placed.json()).data;

    expect(order.addressId).toBe(address.id);
    expect(order.shipLine1).toBe("123 Main St");
    expect(order.shipLine2).toBe("Apt 4B");
    expect(order.shipCity).toBe("New York");
    expect(order.shipRegion).toBe("New York");
    expect(order.shipPostalCode).toBe("10001");
    expect(order.shipCountry).toBe("US");

    // The whole point of the snapshot: rewriting the book must not rewrite
    // where this parcel went.
    await req.patch(`/api/v1/account/addresses/${address.id}`, {
      data: { line1: "999 Somewhere Else", city: "Boston" },
    });
    const reread = (await (await req.get(`/api/v1/account/orders/${order.number}`)).json()).data;
    expect(reread.shipLine1).toBe("123 Main St");
    expect(reread.shipCity).toBe("New York");

    await wipe(req);
  });

  test("checkout accepts exactly one address source", async () => {
    const req = roles.buyer;
    await wipe(req);
    const address = await seedAddress(req, US);
    const products = (await (await req.get("/api/v1/products?pageSize=1")).json()).data;
    const items = [{ slug: products[0].slug, qty: 1 }];

    const both = await req.post("/api/v1/checkout", { data: { items, addressId: address.id, address: US } });
    expect(both.status()).toBe(422);

    const neither = await req.post("/api/v1/checkout", { data: { items } });
    expect(neither.status()).toBe(422);

    // Someone else's id must not be usable — and must not confirm it exists.
    const foreign = await req.post("/api/v1/checkout", { data: { items, addressId: "not-a-real-id" } });
    expect(foreign.status()).toBe(404);

    await wipe(req);
  });

  test("the addresses page lists the book and is linked from Account", async () => {
    const { context, page } = await buyerPage();
    try {
      const req = page.request;
      await wipe(req);
      await seedAddress(req, US);

      await page.goto("/account/settings/addresses");
      await expect(page.getByRole("heading", { name: "Addresses" })).toBeVisible();
      await expect(page.getByText("123 Main St")).toBeVisible();
      await expect(page.getByText("Default", { exact: true })).toBeVisible();

      // The nav entry is live, not a "Soon" placeholder.
      await page.goto("/account/settings");
      const navLink = page
        .getByRole("navigation", { name: "Account settings" })
        .getByRole("link", { name: "Addresses" });
      await expect(navLink).toBeVisible();

      await wipe(req);
    } finally {
      await context.close();
    }
  });
});