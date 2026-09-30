/** Shared shapes for the test-catalog importer. No app imports here. */

export type RawVariant = { name: string; price?: number };

export type RawSpec = { k: string; v: string };

export type RawListing = {
  source: "amazon" | "aliexpress" | "ebay";
  sourceUrl: string;
  externalId: string;
  title: string;
  price: number;
  compareAt?: number;
  images: string[];
  variants: RawVariant[];
  specs: RawSpec[];
  brand?: string;
  categoryHint?: string;
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
