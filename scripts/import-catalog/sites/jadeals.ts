import { decodeEntities, politeFetch } from "../fetch";
import type { RawListing } from "../types";

/**
 * JAdeals via WooCommerce's public Store API — structured JSON, no HTML
 * scraping. Polite pacing reused from fetch.ts; stops at blocks like the
 * HTML adapters. Test import only (see README).
 */

const BASE = "https://jadeals.com/wp-json/wc/store/v1";

/** JMD per USD, documented for honesty; original JMD kept in specs. */
const JMD_PER_USD = 157;

const toUSD = (jmd: number): number => Math.max(0.99, Math.round((jmd / JMD_PER_USD) * 100) / 100);

/** Leaf category id -> our canonical slug. */
export const CATEGORY_MAP: Record<number, string> = {
  74: "phones", // cell-phones
  170: "phones", // cell-phone-cases
  5263: "electronics", // headphones-earbuds
  6488: "electronics", // home-speakers-subwoofers
  3859: "electronics", // computer-keyboards-keypads
  11771: "home", // air-fryers
  12935: "home", // blenders-ice-crushers
  5980: "toys", // board-classic-games
  151: "beauty", // fragrances
};

export type JadealsTarget =
  | { kind: "category"; id: number; category: string }
  | { kind: "search"; query: string; category: string };

export const JADEALS_TARGETS: JadealsTarget[] = [
  { kind: "category", id: 74, category: "phones" },
  { kind: "category", id: 170, category: "phones" },
  { kind: "category", id: 5263, category: "electronics" },
  { kind: "category", id: 6488, category: "electronics" },
  { kind: "category", id: 3859, category: "electronics" },
  { kind: "search", query: "sneakers men", category: "fashion" },
  { kind: "search", query: "dress women summer", category: "fashion" },
  { kind: "search", query: "lego", category: "toys" },
  { kind: "category", id: 5980, category: "toys" },
  { kind: "category", id: 11771, category: "home" },
  { kind: "category", id: 12935, category: "home" },
  { kind: "category", id: 151, category: "beauty" },
  { kind: "search", query: "dumbbell", category: "sports" },
  { kind: "search", query: "motor oil synthetic", category: "automotive" },
];

type StoreProduct = {
  id: number;
  name: string;
  slug: string;
  type: string;
  permalink: string;
  sku: string;
  short_description: string;
  description: string;
  prices: { price: string; regular_price: string; sale_price: string; currency_minor_unit: number };
  average_rating: number;
  review_count: number;
  images: Array<{ src: string }>;
  categories: Array<{ id: number; slug: string }>;
  brands: Array<{ name: string }>;
  attributes: Array<{ name: string; has_variations: boolean; terms: Array<{ name: string }> }>;
  variations: Array<{ id: number; attributes: Array<{ name: string; value: string }> }>;
  is_in_stock: boolean;
};

async function getJSON<T>(url: string): Promise<T> {
  return JSON.parse(await politeFetch(url)) as T;
}

export async function listUrls(target: JadealsTarget, max: number): Promise<RawListing[]> {
  const q =
    target.kind === "category"
      ? `${BASE}/products?category=${target.id}&per_page=${max}`
      : `${BASE}/products?search=${encodeURIComponent(target.query)}&per_page=${max}`;
  const items = await getJSON<StoreProduct[]>(q);
  return items.flatMap((p) => {
    const m = mapProduct(p, target.category);
    return m ? [m] : [];
  });
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function mapProduct(p: StoreProduct, category: string): RawListing | null {
  const minor = 10 ** (p.prices?.currency_minor_unit ?? 0);
  const priceJmd = Number(p.prices?.price ?? NaN) / minor;
  if (!p.name || !Number.isFinite(priceJmd) || priceJmd <= 0) return null;
  const regularJmd = Number(p.prices?.regular_price ?? NaN) / minor;

  const images = [...new Set((p.images ?? []).map((i) => i.src).filter(Boolean))].slice(0, 6);
  if (images.length === 0) return null;

  const specs: RawListing["specs"] = [];
  for (const a of p.attributes ?? []) {
    if (a.has_variations || specs.length >= 12) continue;
    const v = (a.terms ?? []).map((t) => t.name).join(", ");
    if (a.name && v) specs.push({ k: a.name.slice(0, 60), v: v.slice(0, 300) });
  }
  specs.push({ k: "Original price", v: `JMD $${Math.round(priceJmd).toLocaleString()} (converted at JMD ${JMD_PER_USD}/USD for this test import)` });

  const variants: RawListing["variants"] = [];
  for (const v of p.variations ?? []) {
    const label = (v.attributes ?? []).map((a) => `${a.name}: ${a.value}`).join(", ");
    if (label && variants.length < 8) variants.push({ name: label.slice(0, 80) });
  }

  const desc = stripHtml(p.short_description || p.description || "").slice(0, 500);
  const ratingAvg = Number(p.average_rating);
  const ratingCount = Number(p.review_count);

  return {
    source: "jadeals",
    sourceUrl: p.permalink,
    externalId: `jadeals:${p.id}`,
    title: decodeEntities(p.name).replace(/\s+/g, " ").trim().slice(0, 140),
    price: toUSD(priceJmd),
    ...(Number.isFinite(regularJmd) && regularJmd > priceJmd ? { compareAt: toUSD(regularJmd) } : {}),
    images,
    variants,
    specs,
    description: desc || undefined,
    brand: p.brands?.[0]?.name?.slice(0, 40),
    categoryHint: (p.categories ?? []).map((c) => c.slug).join(" "),
    category,
    ...(ratingAvg > 0 && ratingAvg <= 5 ? { ratingAvg } : {}),
    ...(ratingCount > 0 ? { ratingCount } : {}),
  };
}

/** Single-product fetch (rarely needed — list responses are complete). */
export async function fetchProduct(id: number, category: string): Promise<RawListing | null> {
  try {
    const p = await getJSON<StoreProduct>(`${BASE}/products/${id}`);
    return mapProduct(p, category);
  } catch {
    return null;
  }
}
