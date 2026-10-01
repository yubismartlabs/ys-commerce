/**
 * Variant-name → swatch color.
 *
 * Variants are free-text (`"Black"`, `"Color: Red, Size: M"`, `"Navy / L"`),
 * with no structured color field, so the product page derives a swatch dot
 * from the name. Returns a hex string, or null when no known color is found.
 */

const COLOR_HEX: Array<{ hex: string; names: string[] }> = [
  { hex: "#000000", names: ["black", "midnight", "jet black", "graphite"] },
  { hex: "#ffffff", names: ["white", "starlight", "snow", "ivory", "cream"] },
  { hex: "#1e3a8a", names: ["navy", "dark blue", "midnight blue"] },
  { hex: "#2563eb", names: ["blue", "royal blue", "sky blue", "light blue", "cobalt"] },
  { hex: "#ef4444", names: ["red", "crimson", "scarlet"] },
  { hex: "#7f1d1d", names: ["maroon", "burgundy", "wine", "dark red"] },
  { hex: "#16a34a", names: ["green", "forest green", "emerald", "mint", "sage", "olive", "lime", "teal"] },
  { hex: "#f472b6", names: ["pink", "rose", "blush", "hot pink"] },
  { hex: "#a855f7", names: ["purple", "violet", "lavender", "lilac", "plum"] },
  { hex: "#f97316", names: ["orange", "coral", "peach", "tangerine"] },
  { hex: "#eab308", names: ["yellow", "gold", "mustard", "beige", "khaki", "sand", "champagne"] },
  { hex: "#78716c", names: ["gray", "grey", "silver", "charcoal", "slate", "stone", "taupe"] },
  { hex: "#92400e", names: ["brown", "chocolate", "coffee", "tan", "bronze", "copper"] },
  { hex: "#06b6d4", names: ["cyan", "aqua", "turquoise"] },
];

function normalize(name: string): string {
  return ` ${name.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim()} `;
}

/** Hex swatch for a variant name, or null when no known color token matches. */
export function getVariantColor(name: string): string | null {
  if (!name) return null;
  const hay = normalize(name);
  // Longest names first so "light blue" wins over "blue", "jet black" over "black".
  const flat = COLOR_HEX.flatMap((c) => c.names.map((n) => ({ hex: c.hex, name: n }))).sort(
    (a, b) => b.name.length - a.name.length
  );
  for (const { hex, name: token } of flat) {
    if (hay.includes(` ${token} `)) return hex;
  }
  return null;
}
