import type { NormalizedListing, RawListing } from "./types";

/** Our 8 canonical slugs. Keyword rules map foreign titles onto them. */
const CATEGORY_RULES: Array<{ slug: string; re: RegExp }> = [
  { slug: "electronics", re: /(headphone|earbud|airpod|speaker|camera|smart watch|keyboard|mouse|monitor|router|switch|ethernet|laptop|tablet|drone|console|led|light strip|bluetooth|wifi|charger|cable)/i },
  { slug: "phones", re: /(iphone|samsung galaxy|pixel|smartphone|mobile phone|phone case|phone stand|phone mount)/i },
  { slug: "fashion", re: /(dress|shirt|shoe|sneaker|boot|jacket|jeans|handbag|wallet|sunglasses|t-shirt|hoodie|skirt|blouse|sandal)/i },
  { slug: "home", re: /(lamp|blender|vacuum|kitchen|cookware|bedding|pillow|curtain|storage|organizer|furniture|mug|pan|garden hose|lint)/i },
  { slug: "beauty", re: /(serum|cream|lotion|makeup|lipstick|perfume|shampoo|skincare|moisturizer|foundation|mascara)/i },
  { slug: "sports", re: /(yoga|dumbbell|tent|backpack|hiking|fitness|exercise|bike|camping|fishing|mat|solar)/i },
  { slug: "toys", re: /(toy|lego|blocks|doll|puzzle|board game|plush|rc car|stem|kids)/i },
  { slug: "automotive", re: /(car|auto|tire|dash cam|vacuum.*car|motorcycle|truck|vehicle)/i },
];

const TAG_RULES: Array<{ tag: string; re: RegExp }> = [
  { tag: "gaming", re: /(gaming|rgb|mechanical keyboard|streaming|esports)/i },
  { tag: "fitness", re: /(fitness|workout|gym|running|yoga|exercise)/i },
  { tag: "outdoors", re: /(outdoor|waterproof|camping|hiking|tent|trail)/i },
  { tag: "camping", re: /(camping|tent|sleeping bag|lantern)/i },
  { tag: "giftable", re: /(gift|present)/i },
  { tag: "offgrid", re: /(off.?grid|solar power|power station|cabin)/i },
  { tag: "audio", re: /(earbud|headphone|speaker|airpod|bluetooth audio|soundbar)/i },
  { tag: "home-decor", re: /(decor|led strip|lights|ambiance)/i },
  { tag: "kitchen", re: /(kitchen|blender|cook|coffee|air fryer)/i },
  { tag: "skincare", re: /(serum|skincare|moisturizer|cream|lotion)/i },
  { tag: "travel", re: /(travel|luggage|suitcase|passport)/i },
  { tag: "office", re: /(office|desk|ergonomic|monitor stand)/i },
  { tag: "networking", re: /(router|switch|ethernet|mesh|wifi|network)/i },
  { tag: "power", re: /(power station|generator|solar panel|battery pack)/i },
];

function slugify(title: string, externalId: string): string {
  const base =
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 44) || "product";
  // Tail of the encoding, not the head: shared prefixes ("jadeals:", "amz:")
  // encode identically, so head-slices collide across rows.
  const hash = Buffer.from(externalId).toString("base64url").replace(/[^a-z0-9]/gi, "").slice(-8);
  return `${base}-${hash}`;
}

/** Validate + map a raw scrape into our product shape. Null = unusable, skip. */
export function normalize(raw: RawListing): NormalizedListing | null {
  if (raw.title.length < 5 || raw.images.length === 0) return null;
  const hay = `${raw.title} ${raw.categoryHint ?? ""}`;
  const category = raw.category ?? CATEGORY_RULES.find((r) => r.re.test(hay))?.slug ?? "electronics";
  const tags = TAG_RULES.filter((r) => r.re.test(hay)).map((r) => r.tag).slice(0, 8);
  return {
    slug: slugify(raw.title, raw.externalId),
    title: raw.title,
    description: raw.description?.slice(0, 500) ?? `Imported test listing from ${raw.source} for evaluation. Not a live offer.`,
    image: raw.images[0],
    images: raw.images,
    specs: raw.specs.slice(0, 12).map((s) => ({ k: s.k.slice(0, 60), v: s.v.slice(0, 300) })),
    price: raw.price,
    compareAt: raw.compareAt && raw.compareAt > raw.price ? raw.compareAt : null,
    category,
    brand: raw.brand?.slice(0, 40) ?? null,
    tags,
    ratingAvg: 0,
    ratingCount: 0,
    freeShipping: true,
    source: raw.source,
    sourceUrl: raw.sourceUrl,
    externalId: raw.externalId,
  };
}
