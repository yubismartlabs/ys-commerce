/**
 * Marketplace usernames (eBay-style seller handles).
 *
 * Rules:
 * - 3–30 chars, lowercase, letters/numbers plus `.`, `_`, `-`.
 * - Must start and end with a letter or number.
 * - Unique across users (case-insensitive — stored lowercase).
 * - Never one of the reserved words (admin impersonation, route
 *   squatting like `selling`/`account`/`store`, or the defaults below
 *   plus whatever the operator adds in ys-admin → Settings → Usernames).
 *
 * Custom usernames can only be claimed when opening a store
 * (become-seller). Everyone else gets an auto-generated one from
 * their display name at signup.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])$/;

/** Built-in blocklist. Operators extend it via the `usernames` setting group. */
export const DEFAULT_RESERVED_USERNAMES = [
  // Impersonation / trust & safety
  "admin",
  "administrator",
  "moderator",
  "mod",
  "support",
  "help",
  "safety",
  "security",
  "official",
  "verified",
  "staff",
  "team",
  "system",
  "root",
  "owner",
  "service",
  // Marketplace routes (squatting / phishing)
  "api",
  "auth",
  "account",
  "cart",
  "checkout",
  "deals",
  "search",
  "selling",
  "store",
  "stores",
  "product",
  "products",
  "orders",
  "messages",
  "notifications",
  "watchlist",
  "settings",
  "sign-in",
  "signin",
  "sign-up",
  "signup",
  "login",
  "logout",
  "maintenance",
  "robots",
  "sitemap",
  "u",
  "user",
  "users",
  "ys-admin",
  "admin-console",
  // Brand
  "ys",
  "ys-commerce",
  "yscommerce",
] as const;

/** Lowercase + trim. Returns "" for empty input. */
export function normalizeUsername(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

/** Shape check only (length + charset). Reserved/unique checks are separate. */
export function isUsernameFormatValid(username: string): boolean {
  const v = normalizeUsername(username);
  if (v.length < USERNAME_MIN || v.length > USERNAME_MAX) return false;
  return USERNAME_RE.test(v);
}

/** Case-insensitive reserved-word check against defaults + operator list. */
export function isUsernameReserved(username: string, extraReserved: string[] = []): boolean {
  const v = normalizeUsername(username);
  if (!v) return true;
  const blocked = new Set<string>([
    ...DEFAULT_RESERVED_USERNAMES,
    ...extraReserved.map((s) => normalizeUsername(s)).filter(Boolean),
  ]);
  if (blocked.has(v)) return true;
  // Sub-domain style squats: "admin.store", "support-team", etc.
  const bare = v.replace(/[._-]+/g, "");
  for (const r of DEFAULT_RESERVED_USERNAMES) {
    if (bare === r.replace(/[._-]+/g, "")) return true;
  }
  return false;
}

export type UsernameCheck =
  | { ok: true; value: string }
  | { ok: false; reason: "FORMAT" | "RESERVED" };

/** Format + reserved check. Uniqueness is checked against the DB by callers. */
export function checkUsername(raw: string, extraReserved: string[] = []): UsernameCheck {
  const value = normalizeUsername(raw);
  if (!isUsernameFormatValid(value)) return { ok: false, reason: "FORMAT" };
  if (isUsernameReserved(value, extraReserved)) return { ok: false, reason: "RESERVED" };
  return { ok: true, value };
}

/**
 * Auto-generate a handle from a display name ("Ada Lovelace" → "ada.lovelace").
 * Falls back to the email local part, then to "shopper". Callers append a
 * numeric suffix until it is unique.
 */
export function baseUsernameFromName(name: string | null | undefined, email?: string): string {
  const fromName = (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".")
    .slice(0, 24)
    .replace(/^\.+|\.+$/g, "");
  if (fromName && fromName.replace(/[._-]+/g, "").length >= 2) return fromName;
  const local = (email ?? "").split("@")[0]?.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 24);
  if (local && local.replace(/[._-]+/g, "").length >= 2) return local;
  return "shopper";
}

/** Human-readable error for the API / forms. */
export function usernameErrorMessage(reason: "FORMAT" | "RESERVED" | "TAKEN"): string {
  if (reason === "RESERVED") return "That username is reserved. Try another one.";
  if (reason === "TAKEN") return "That username is taken. Try another one.";
  return `Use ${USERNAME_MIN}–${USERNAME_MAX} lowercase letters/numbers with . _ - (must start and end with a letter or number).`;
}
