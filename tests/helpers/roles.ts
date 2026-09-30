import { request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import path from "node:path";

/**
 * API contexts for each saved session, so a cross-role spec can act as the
 * buyer, the seller and support in the same test.
 */
export type Roles = {
  buyer: APIRequestContext;
  seller: APIRequestContext;
  /** A second, unrelated seller — for cross-store authorization checks. */
  seller2: APIRequestContext;
  admin: APIRequestContext;
};

export async function roleContexts(baseURL: string): Promise<Roles> {
  const state = (role: string) => path.join(process.cwd(), "playwright", ".auth", `${role}.json`);
  return {
    buyer: await playwrightRequest.newContext({ storageState: state("buyer"), baseURL }),
    seller: await playwrightRequest.newContext({ storageState: state("seller"), baseURL }),
    seller2: await playwrightRequest.newContext({ storageState: state("seller2"), baseURL }),
    admin: await playwrightRequest.newContext({ storageState: state("admin"), baseURL }),
  };
}

export async function disposeRoles(roles: Roles) {
  await Promise.all(Object.values(roles).map((c) => c.dispose()));
}
