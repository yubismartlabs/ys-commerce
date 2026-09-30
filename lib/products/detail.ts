import { auth } from "@/auth";
import { db } from "@/lib/db";
import { parseSpecs, ratingDistribution } from "@/lib/products/ratings";
import { getActiveDeal } from "@/lib/deals/pricing";
import { relatedCardRows } from "@/lib/products/feed";
import { safeImageList, safeImageSrc } from "@/lib/images";
import { ApiError } from "@/lib/api/guard";
import type { ApiCardRow } from "@/components/commerce/api-product-card";

/**
 * Single loader for a product detail page, shared by the storefront page
 * (server component, so it can call notFound()) and the public JSON API.
 *
 * Image URLs are sanitized here because this bypasses the `serialize()` choke
 * point used by the API routes.
 */

export type ProductVariant = {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  image: string | null;
  stock: number;
};

export type ProductDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image: string;
  images: string[];
  specs: Array<{ k: string; v: string }>;
  price: number;
  compareAt: number | null;
  category: string;
  badge: string | null;
  freeShipping: boolean;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  variants: ProductVariant[];
  distribution: Array<{ rating: number; count: number }>;
  related: ApiCardRow[];
  store: { id: string; name: string; slug: string; ratingAvg: number; followerCount: number };
  deal: { id: string; dealPrice: number; endsAt: string | Date; stockCap: number | null; soldCount: number } | null;
  viewer: { reviewed: boolean; wishlisted: boolean };
};

/** Throws a 404 ApiError when the product is missing, draft, or taken down. */
export async function loadProduct(slug: string): Promise<ProductDetail> {
  const product = await db.product.findUnique({
    where: { slug },
    include: {
      store: { select: { id: true, name: true, slug: true, ratingAvg: true, followerCount: true } },
      variants: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!product || product.status !== "ACTIVE") {
    throw new ApiError("NOT_FOUND", "Product not found", 404);
  }

  const [distribution, related, deal] = await Promise.all([
    ratingDistribution(product.id),
    relatedCardRows(product.id, product.category, 10),
    getActiveDeal(product.id),
  ]);

  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  const [mine, wished] = userId
    ? await Promise.all([
        db.review.findUnique({
          where: { productId_authorId: { productId: product.id, authorId: userId } },
          select: { id: true },
        }),
        db.wishlistItem.findUnique({
          where: { userId_productId: { userId, productId: product.id } },
          select: { id: true },
        }),
      ])
    : [null, null];

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    image: safeImageSrc(product.image),
    images: safeImageList(product.images),
    specs: parseSpecs(product.specs),
    price: Number(product.price),
    compareAt: product.compareAt === null ? null : Number(product.compareAt),
    category: product.category,
    badge: product.badge,
    freeShipping: product.freeShipping,
    store: product.store,
    ratingAvg: product.ratingAvg,
    ratingCount: product.ratingCount,
    soldCount: product.soldCount,
    variants: product.variants.map((v) => ({
      ...v,
      price: v.price === null ? null : Number(v.price),
      image: safeImageSrc(v.image),
    })),
    distribution,
    related,
    deal: deal ? { ...deal, dealPrice: Number(deal.dealPrice) } : null,
    viewer: { reviewed: !!mine, wishlisted: !!wished },
  };
}
