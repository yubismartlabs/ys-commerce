/**
 * Canonical category taxonomy.
 *
 * `Product.category` is a free-text column, and the storefront previously sent
 * display names ("Home & Garden") into a case-sensitive exact-match filter
 * against lowercase slugs ("home") — so every category link returned zero
 * results. Everything user-facing now navigates by SLUG, and any inbound
 * string is normalized through `normalizeCategory()` before it reaches SQL.
 */

export type CategoryDef = {
  slug: string;
  label: string;
  /** Decorative tile art. Replace with uploaded artwork per category later. */
  image: string;
};

/** Single source of truth for the header nav, mobile menu and home tiles. */
export const CATEGORIES: CategoryDef[] = [
  { slug: "electronics", label: "Electronics", image: "https://picsum.photos/seed/cat-electronics/160/160" },
  { slug: "fashion", label: "Fashion", image: "https://picsum.photos/seed/cat-fashion/160/160" },
  { slug: "home", label: "Home & Garden", image: "https://picsum.photos/seed/cat-home/160/160" },
  { slug: "beauty", label: "Beauty", image: "https://picsum.photos/seed/cat-beauty/160/160" },
  { slug: "sports", label: "Sports", image: "https://picsum.photos/seed/cat-sports/160/160" },
  { slug: "toys", label: "Toys & Kids", image: "https://picsum.photos/seed/cat-toys/160/160" },
  { slug: "automotive", label: "Automotive", image: "https://picsum.photos/seed/cat-automotive/160/160" },
  { slug: "phones", label: "Phones", image: "https://picsum.photos/seed/cat-phones/160/160" },
];

/** Display names and legacy spellings that must resolve to a canonical slug. */
const ALIASES: Record<string, string> = {
  "all categories": "",
  all: "",
  "all products": "",
  "home & garden": "home",
  "home and garden": "home",
  homegarden: "home",
  "toys & kids": "toys",
  "toys and kids": "toys",
  kids: "toys",
  electronics: "electronics",
  "consumer electronics": "electronics",
  fashion: "fashion",
  clothing: "fashion",
  beauty: "beauty",
  sports: "sports",
  sport: "sports",
  automotive: "automotive",
  auto: "automotive",
  phones: "phones",
  phone: "phones",
  smartphones: "phones",
};

/** Title-cases a free-text category for display ("power tools" -> "Power Tools"). */
export function categoryLabel(slug: string): string {
  const known = CATEGORIES.find((c) => c.slug === slug);
  if (known) return known.label;
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Map any inbound category string to its canonical slug. Unknown values are
 * lowercased and hyphenated rather than rejected, so seller-entered
 * categories keep working (the SQL match is case-insensitive either way).
 */
export function normalizeCategory(raw: string | null | undefined): string {
  if (raw == null) return "";
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return "";
  if (key in ALIASES) return ALIASES[key];
  const squashed = key.replace(/[\s&_]+/g, "-").replace(/^-+|-+$/g, "");
  return squashed;
}

/** Resolve a `?category=` param for a browse link. */
export function categoryHref(slug: string, extra?: Record<string, string>): string {
  const q = new URLSearchParams({ category: slug, ...(extra ?? {}) });
  return `/search?${q.toString()}`;
}
