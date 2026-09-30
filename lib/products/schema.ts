import { z } from "zod";
import { describeImagePolicy, isAllowedImageUrl } from "@/lib/images";

/**
 * Seller-supplied image URL. Rejects hosts outside the allowlist at SAVE time
 * so `next/image` can never be handed an unconfigured host at render.
 */
const imageUrlSchema = z
  .string()
  .trim()
  .min(1, "Image is required")
  .max(500)
  .refine(isAllowedImageUrl, { message: describeImagePolicy() });

const optionalImageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || isAllowedImageUrl(v), { message: describeImagePolicy() })
  .optional()
  .nullable();

export const variantSchema = z.object({
  name: z.string().min(1).max(80),
  sku: z.string().max(40).optional().nullable(),
  price: z.number().min(0).max(1000000).optional().nullable(),
  image: optionalImageUrlSchema,
  stock: z.number().int().min(0).max(1000000).default(0),
});

const specSchema = z.object({ k: z.string().min(1).max(60), v: z.string().max(300) });

export const productInput = z.object({
  title: z.string().min(2).max(140),
  description: z.string().max(5000).optional().nullable(),
  image: imageUrlSchema,
  images: z.array(imageUrlSchema).max(10).default([]),
  specs: z.array(specSchema).max(50).default([]),
  price: z.number().min(0.01).max(1000000),
  compareAt: z.number().min(0.01).max(1000000).optional().nullable(),
  category: z.string().min(1).max(60),
  brand: z.string().trim().max(40).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
  badge: z.string().max(20).optional().nullable(),
  freeShipping: z.boolean().default(true),
  // Listing-level stock, for products with no variants. Opt-in: when
  // trackStock is false the listing is treated as always available.
  trackStock: z.boolean().default(false),
  stock: z.number().int().min(0).max(100000000).default(0),
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
