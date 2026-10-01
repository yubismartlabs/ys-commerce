/**
 * Central role/permission model.
 *
 * Accounts are flat (BUYER / ADMIN) — anyone can open a store and list,
 * so there is no SELLER role. "Seller" is derived from store ownership
 * (Store.ownerId), never from the role column. Staff access is scope-based:
 * a user's effective scopes = role scopes + staff-role scopes + per-user
 * overrides. ADMIN always resolves to ["*"].
 *
 * To add a new staff role: create a StaffRole row (ys-admin → Users → Roles)
 * with any of the AREAS below. No code changes needed — every admin route
 * declares its area via withAdmin(handler, "<area>") and the console +
 * middleware gate on the same list.
 */

export type Role = "BUYER" | "ADMIN";

export const ROLES: Role[] = ["BUYER", "ADMIN"];

/** Admin console areas. "admin" = superuser-only (tokens, destructive user ops). */
export const AREAS = [
  "vendors",
  "products",
  "orders",
  "disputes",
  "coupons",
  "deals",
  "payouts",
  "emails",
  "settings",
  "users",
  "ops",
  "chat",
  "admin",
] as const;

export type Area = (typeof AREAS)[number];

const ROLE_SCOPES: Record<Role, string[]> = {
  ADMIN: ["*"],
  BUYER: [],
};

/** Union of role scopes, staff-role scopes and per-user overrides. */
export function effectiveScopes(input: {
  role: Role | string;
  scopes?: string[];
  staffScopes?: string[];
}): string[] {
  const base = (ROLE_SCOPES as Record<string, string[]>)[input.role] ?? [];
  return [...new Set([...base, ...(input.staffScopes ?? []), ...(input.scopes ?? [])])];
}

/** Does this effective scope set grant an area? */
export function hasScope(effective: string[], area: string): boolean {
  return effective.includes("*") || effective.includes(area);
}

export function can(
  role: Role | string,
  scope: string,
  extra: string[] = [],
  staffScopes: string[] = []
): boolean {
  return hasScope(effectiveScopes({ role, scopes: extra, staffScopes }), scope);
}

export function isAdmin(role: string | undefined, extra: string[] = []): boolean {
  return role === "ADMIN" && can("ADMIN", "*", extra);
}

/** Console-level access: full admins or anyone holding ≥1 scope. */
export function canAccessConsole(role: string | undefined, effective: string[]): boolean {
  return role === "ADMIN" || effective.length > 0;
}
