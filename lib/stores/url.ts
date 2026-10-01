import { normalizeUsername } from "@/lib/usernames";

/**
 * Canonical public URL for a store: /store/@username once the store has a
 * handle, falling back to the legacy /store/<slug> for pre-handle rows.
 * The storefront resolves both — slug URLs redirect to the @ URL.
 */
export function storeUrl(store: { slug: string; username?: string | null }): string {
  const handle = normalizeUsername(store.username);
  return handle ? `/store/@${handle}` : `/store/${store.slug}`;
}

/** Display handle: @username, or @slug as a last resort (never blank). */
export function storeHandle(store: { slug: string; username?: string | null }): string {
  return `@${normalizeUsername(store.username) || store.slug}`;
}

/** Strip a leading @ from a route param for DB lookup. */
export function stripAtParam(raw: string | null | undefined): string {
  return normalizeUsername(raw).replace(/^@+/, "");
}
