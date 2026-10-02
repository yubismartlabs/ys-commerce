/**
 * Shopping preferences: the sizes and brands a buyer wants surfaced back.
 *
 * Kept free-form on purpose. "Size" is footwear in one category, a shirt
 * letter in the next and a waist in inches in a third, so a fixed enum would
 * reject exactly the buyers this is meant to serve. What we DO fix is
 * normalisation, so "nike", " Nike " and "NIKE" are one preference rather than
 * three, and a brand typed twice cannot silently match only one of the rows.
 */

export const PREFERENCE_KINDS = ["SIZE", "BRAND"] as const;
export type PreferenceKind = (typeof PREFERENCE_KINDS)[number];

export const MAX_SIZES = 24;
export const MAX_BRANDS = 40;

const LIMITS: Record<PreferenceKind, number> = { SIZE: MAX_SIZES, BRAND: MAX_BRANDS };

/**
 * Normalise one value. Brands are title-cased so they read consistently in the
 * chips and match a product's brand field regardless of how it was catalogued;
 * sizes keep their case because "XXL" and "xxl" are the same size but "M" and
 * "m" are not.
 */
export function normalizeValue(kind: PreferenceKind, raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (kind === "SIZE") return trimmed;
  return trimmed
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export function limitFor(kind: PreferenceKind): number {
  return LIMITS[kind];
}

export function validateValue(kind: PreferenceKind, raw: string): { value: string } | { error: string } {
  const value = normalizeValue(kind, raw);
  if (value.length < 1) return { error: "Enter a value" };
  if (value.length > 40) return { error: "Keep it under 40 characters" };
  return { value };
}

/**
 * Does `haystack` (a product brand) match a saved preference?
 * Case- and punctuation-insensitive, because catalogued brand strings are not
 * consistent: "Levi's", "levis" and "Levi 's" are all the same brand to a buyer.
 */
export function brandMatches(preference: string, brand: string | null | undefined): boolean {
  if (!brand) return false;
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const a = clean(preference);
  return a.length > 0 && clean(brand) === a;
}

/**
 * Pull the size out of a stored variant name. Variants are stored as
 * "Attribute: value" pairs — "Color: Red, Size: M" — and may also be a bare
 * value ("M", "Midnight 40mm"), in which case the whole name is the candidate.
 *
 * Returning null rather than guessing is deliberate: badging "L" on a variant
 * called "Large" would be worse than badging nothing.
 */
export function variantSize(name: string): string | null {
  const parts = name.split(",").map((p) => p.trim());
  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx > 0) {
      const key = part.slice(0, idx).trim().toLowerCase();
      if (key === "size" || key === "pa_size") {
        const value = part.slice(idx + 1).trim();
        return value || null;
      }
    }
  }
  // Bare value: only treat it as a size if it actually looks like one, so a
  // colour-only variant isn't badged with its own name.
  if (parts.length === 1 && parts[0] && /^(xxs|xs|s|m|l|xl|xxl|xxxl|xxxxl|\d{1,3}(\.\d)?|\d{1,2}\s?\d{1,2})$/i.test(parts[0].trim())) {
    return parts[0].trim();
  }
  return null;
}

/** Does a variant size match one of the buyer's saved sizes? */
export function sizeMatches(variantName: string, sizes: string[]): boolean {
  if (sizes.length === 0) return false;
  const v = variantSize(variantName);
  if (!v) return false;
  const clean = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
  const target = clean(v);
  return sizes.some((s) => clean(s) === target);
}

/** Offered on the page as one-tap chips; a buyer can still type anything. */
export const SUGGESTED_SIZES = [
  "XS", "S", "M", "L", "XL", "XXL", "XXXL",
  "6", "7", "8", "9", "10", "11", "12",
  "28", "30", "32", "34", "36", "38", "40",
] as const;