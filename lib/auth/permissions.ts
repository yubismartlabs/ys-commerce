/**
 * Central role/permission model.
 *
 * Account types stay flat (BUYER / SELLER / ADMIN) while staff access is
 * scope-based: a user's effective scopes = role scopes + staff-role scopes
 * + per-user overrides. ADMIN always resolves to ["*"].
 *
 * To add a new staff role: create a StaffRole row (ys-admin → Users → Roles)
 * with any of the AREAS below. No code changes needed — every admin route
 * declares its area via withAdmin(handler, "<area>") and the console +
 * middleware gate on the same list.
 */

export type Role = "BUYER" | "SELLER" | "ADMIN";

export const ROLES: Role[] = ["BUYER", "SELLER", "ADMIN"];

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
  SELLER: ["selling"],
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
