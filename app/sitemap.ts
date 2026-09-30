import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { CATEGORIES, categoryHref } from "@/lib/categories";

/**
 * Product and store URLs are the organic surface of a marketplace — without
 * this, crawlers only ever saw the client-fetched shell.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const now = new Date();

  let products: Array<{ slug: string; updatedAt: Date }> = [];
  let stores: Array<{ slug: string; updatedAt: Date }> = [];
  try {
    [products, stores] = await Promise.all([
      db.product.findMany({
        where: { status: "ACTIVE" },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 5000,
      }),
      db.store.findMany({
        where: { status: "APPROVED" },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 2000,
      }),
    ]);
  } catch (e) {
    console.error("[sitemap] falling back to static routes only:", e);
  }

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/deals`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/search`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    ...CATEGORIES.map((c) => ({
      url: `${base}${categoryHref(c.slug)}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${base}/product/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...stores.map((s) => ({
      url: `${base}/store/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
