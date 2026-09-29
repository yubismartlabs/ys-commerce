import { z } from "zod";

const variantSchema = z.object({
  name: z.string().min(1).max(80),
  sku: z.string().max(40).optional().nullable(),
  price: z.number().min(0).max(1000000).optional().nullable(),
  image: z.string().url().max(500).optional().nullable(),
  stock: z.number().int().min(0).max(1000000).default(0),
});

const specSchema = z.object({ k: z.string().min(1).max(60), v: z.string().max(300) });

export const productInput = z.object({
  title: z.string().min(2).max(140),
  description: z.string().max(5000).optional().nullable(),
  image: z.string().url().max(500),
  images: z.array(z.string().url().max(500)).max(10).default([]),
  specs: z.array(specSchema).max(50).default([]),
  price: z.number().min(0.01).max(1000000),
  compareAt: z.number().min(0.01).max(1000000).optional().nullable(),
  category: z.string().min(1).max(60),
  badge: z.string().max(20).optional().nullable(),
  freeShipping: z.boolean().default(true),
  storeId: z.string().min(1),
  variants: z.array(variantSchema).max(30).default([]),
});

export type ProductInput = z.infer<typeof productInput>;

export function slugify(title: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "product";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}
