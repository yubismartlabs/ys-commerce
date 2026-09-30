/** Shared shapes for the test-catalog importer. No app imports here. */

export type RawVariant = { name: string; price?: number };

export type RawSpec = { k: string; v: string };

export type RawListing = {
  source: "amazon" | "aliexpress" | "ebay" | "jadeals";
  sourceUrl: string;
  externalId: string;
  title: string;
  price: number;
  compareAt?: number;
  images: string[];
  variants: RawVariant[];
  specs: RawSpec[];
  brand?: string;
  /** Real short description when the source provides one (Jadeals API). */
  description?: string;
  categoryHint?: string;
  /** Our canonical slug, when the adapter already knows it (skips keyword mapping). */
  category?: string;
  ratingAvg?: number;
  ratingCount?: number;
};

export type NormalizedListing = {
  slug: string;
  title: string;
  description: string | null;
  image: string;
  images: string[];
  specs: RawSpec[];
  price: number;
  compareAt: number | null;
  category: string;
  brand: string | null;
  tags: string[];
  ratingAvg: number;
  ratingCount: number;
  freeShipping: boolean;
  source: string;
  sourceUrl: string;
  externalId: string;
};
