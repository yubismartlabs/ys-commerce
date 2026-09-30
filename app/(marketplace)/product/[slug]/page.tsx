import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadProduct } from "@/lib/products/detail";
import { ApiError } from "@/lib/api/guard";
import { ProductView } from "@/components/products/product-view";
import { discountPct } from "@/lib/format";
import { getSettingGroup } from "@/lib/server-settings";

/**
 * Server component so a missing/taken-down product returns a real 404
 * (status + `noindex`) instead of a 200 page reading "Product not found", and
 * so crawlers and link unfurlers get real titles, descriptions and images.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  let product;
  try {
    product = await loadProduct(slug);
  } catch {
    return { title: "Product not found", robots: { index: false, follow: false } };
  }
  const [site, commerce] = await Promise.all([getSettingGroup("site"), getSettingGroup("commerce")]);
  const price = product.deal?.dealPrice ?? product.price;
  const compareAt = product.deal ? product.price : product.compareAt;
  const pct = discountPct(price, compareAt ?? undefined);
  const title = `${product.title}${pct ? ` — ${pct}% off` : ""} | ${site.siteName}`;
  const description =
    product.description?.slice(0, 200) ??
    `${product.title} from ${product.store.name}. ${product.ratingCount} reviews, ${product.soldCount} sold.`;

  return {
    title,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.title,
      description,
      images: [{ url: product.image, width: 800, height: 800, alt: product.title }],
    },
    twitter: { card: "summary_large_image", title: product.title, description, images: [product.image] },
    other: {
      "product:price:amount": price.toFixed(2),
      "product:price:currency": "USD",
      "product:rating:average": product.ratingAvg.toFixed(1),
      "product:review_count": String(product.ratingCount),
      "product:availability": product.variants.length > 0 && product.variants.every((v) => v.stock <= 0)
        ? "out of stock"
        : "in stock",
      ...(commerce.buyerProtectionDays ? { "product:protection_days": String(commerce.buyerProtectionDays) } : {}),
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product: Awaited<ReturnType<typeof loadProduct>>;
  try {
    product = await loadProduct(slug);
  } catch (e) {
    // notFound() must be called in the render path; it throws the 404 that
    // Next turns into a real 404 status + noindex.
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const shipping = await getSettingGroup("shipping").catch(() => null);
  return <ProductView product={product} shippingFee={shipping?.defaultFee ?? 1.99} />;
}
