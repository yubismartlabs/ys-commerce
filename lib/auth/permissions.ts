/**
 * Central role/permission model.
 *
 * Today roles are flat (BUYER / SELLER / ADMIN). To add staff roles later
 * (e.g. SUPPORT with orders+disputes scopes, FINANCE with payouts):
 *  1. extend the Prisma Role enum,
 *  2. add its scopes to ROLE_SCOPES below,
 *  3. assign per-user overrides via User.scopes.
 * No route guard changes needed — everything funnels through can().
 */

export type Role = "BUYER" | "SELLER" | "ADMIN";

export const ROLES: Role[] = ["BUYER", "SELLER", "ADMIN"];

// "*" = full access. Scopes name admin areas (vendors, products, orders,
// disputes, coupons, payouts, users, emails, settings, ops).
const ROLE_SCOPES: Record<Role, string[]> = {
  ADMIN: ["*"],
  SELLER: ["selling"],
  BUYER: [],
};

export function scopesFor(role: Role, extra: string[] = []): string[] {
  return [...new Set([...ROLE_SCOPES[role], ...extra])];
}

/** Does this role (+optional per-user scopes) grant an action/scope? */
export function can(role: Role, scope: string, extra: string[] = []): boolean {
  const scopes = scopesFor(role, extra);
  return scopes.includes("*") || scopes.includes(scope);
}

export function isAdmin(role: string | undefined, extra: string[] = []): boolean {
  return role === "ADMIN" && can("ADMIN", "*", extra);
}
