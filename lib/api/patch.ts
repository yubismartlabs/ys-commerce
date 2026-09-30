/**
 * Helpers for PATCH endpoints whose schema is derived from a create schema via
 * `.partial()`.
 *
 * The trap: `z.number().default(0)` inside `.partial()` still yields `0` for an
 * omitted key, so spreading the parse result into a Prisma update silently
 * resets every defaulted field on every partial edit. For products that wiped
 * `stock`, `images`, `specs` and `variants`; for coupons it wiped the
 * category/store scoping. `pickSent` keeps only the keys the client actually
 * sent, so absent fields are left untouched in the database.
 */

/** Keys of `body` that are present (even if explicitly `null`). */
function sentKeys(body: unknown): Set<string> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return new Set();
  return new Set(Object.keys(body as Record<string, unknown>));
}

/**
 * Filter a parsed PATCH payload down to the keys the client actually sent,
 * dropping anything the schema filled in from a `.default()`.
 */
export function pickSent<T extends Record<string, unknown>>(parsed: T, body: unknown): Partial<T> {
  const keys = sentKeys(body);
  if (keys.size === 0) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (keys.has(k)) out[k] = v;
  }
  return out as Partial<T>;
}

/** True when the client sent the key, so an array replace is intentional. */
export function wasSent(body: unknown, key: string): boolean {
  return sentKeys(body).has(key);
}
