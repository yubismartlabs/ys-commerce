/**
 * Display helpers for product variants.
 *
 * Imported listings store options as "Attribute: value" pairs
 * ("Color: Red", "Color: Red, Size: M") — and checkout/cart key cart lines
 * on that exact stored string, so it must never be renamed in the database.
 * These helpers only affect what buyers SEE.
 */

/**
 * "Color: Red, Size: M" -> "Red, M". Plain names ("Black", "Midnight 40mm")
 * pass through untouched, as does anything where the colon isn't an
 * attribute prefix ("12:30").
 */
export function displayVariantName(name: string): string {
  return name
    .split(",")
    .map((part) => {
      const idx = part.indexOf(":");
      if (idx <= 0) return part.trim();
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      // Attribute keys are short and letter-led ("Color", "Size",
      // "pa_color"); anything else keeps its colon.
      if (value && /^[A-Za-z][A-Za-z0-9 _-]{0,30}$/.test(key)) return value;
      return part.trim();
    })
    .filter(Boolean)
    .join(", ");
}
