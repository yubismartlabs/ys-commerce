import { test, expect } from "@playwright/test";
import { roleContexts, disposeRoles, type Roles } from "./helpers/roles";

/**
 * Store @handles: public /store/@username URLs, shared user+store
 * namespace, and the lifetime cap on renames.
 *
 * The money property is handle stability: buyers bookmark and share @links,
 * so renames must be rare (capped for life) while legacy /store/<slug>
 * links keep resolving via redirect metadata (canonical).
 */
let roles: Roles;

test.beforeAll(async () => {
  roles = await roleContexts(test.info().project.use.baseURL as string);
});

test.afterAll(async () => {
  if (roles) await disposeRoles(roles);
});

const suffix = () => Math.random().toString(36).slice(2, 8);

async function ownStore() {
  const envelope = await (await roles.seller2.get("/api/v1/account/selling/store")).json();
  return envelope.data[0] as { id: string; slug: string; username: string; usernameChangeCount: number };
}

test("availability shares one namespace for users and stores", async () => {
  const store = await ownStore();

  const reserved = await (await roles.buyer.get("/api/v1/account/username/availability?username=admin")).json();
  expect(reserved.data.available).toBe(false);
  expect(reserved.data.reason).toBe("RESERVED");

  const takenByStore = await (
    await roles.buyer.get(`/api/v1/account/username/availability?username=${store.username}`)
  ).json();
  expect(takenByStore.data.available).toBe(false);
  expect(takenByStore.data.reason).toBe("TAKEN");

  const free = await (
    await roles.buyer.get(`/api/v1/account/username/availability?username=e2e-free-${suffix()}`)
  ).json();
  expect(free.data.available).toBe(true);
});

test("store resolves by @handle and by legacy slug with canonical @ URL", async () => {
  const store = await ownStore();

  const byHandle = await (await roles.buyer.get(`/api/v1/stores/@${store.username}`)).json();
  expect(byHandle.data.store.id).toBe(store.id);

  const bySlug = await (await roles.buyer.get(`/api/v1/stores/${store.slug}`)).json();
  expect(bySlug.data.store.id).toBe(store.id);
  expect(bySlug.meta.canonical).toBe(`/store/@${store.username}`);
});

test("store username renames are capped for life", async () => {
  const settings = await (await roles.admin.get("/api/v1/admin/settings")).json();
  const maxChanges = settings.data.usernames.storeUsernameMaxChanges as number;
  expect(maxChanges).toBeGreaterThanOrEqual(1);

  const store = await ownStore();
  const patch = (username: string) =>
    roles.seller2.patch(`/api/v1/account/selling/store?id=${store.id}`, { data: { username } });

  let current = store.username;
  for (let i = 0; i < maxChanges; i++) {
    const next = `e2e.shop.${suffix()}`;
    const res = await patch(next);
    expect(res.status(), `rename ${i + 1} should succeed`).toBe(200);
    const body = await res.json();
    expect(body.data.username).toBe(next);
    expect(body.data.usernameChangesRemaining).toBe(maxChanges - i - 1);
    expect(body.data.usernameChangeCount).toBe(store.usernameChangeCount + i + 1);
    current = next;
  }

  // Cap exhausted — one more rename is forbidden, and the handle sticks.
  const denied = await patch(`e2e.shop.${suffix()}`);
  expect(denied.status()).toBe(403);
  const deniedBody = await denied.json();
  expect(JSON.stringify(deniedBody)).toMatch(/all .* change|can't be changed/i);

  const fresh = await ownStore();
  expect(fresh.username).toBe(current);

  // The new @ URL resolves.
  const byHandle = await (await roles.buyer.get(`/api/v1/stores/@${current}`)).json();
  expect(byHandle.data.store.id).toBe(store.id);
});
