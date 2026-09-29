import { ProductCard, type CardProduct } from "@/components/commerce/product-card";

/** Live API product row shape for cards. */
export type ApiCardRow = {
  slug: string;
  title: string;
  image: string;
  price: number;
  compareAt?: number | null;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  badge?: string | null;
  freeShipping: boolean;
};

/** Map a live API product row to card fields. */
export function apiToCard(p: ApiCardRow): CardProduct {
  return {
    slug: p.slug,
    title: p.title,
    image: p.image,
    price: Number(p.price),
    compareAt: p.compareAt === null || p.compareAt === undefined ? undefined : Number(p.compareAt),
    rating: p.ratingAvg,
    reviews: p.ratingCount,
    sold: p.soldCount,
    badge: p.badge,
    freeShipping: p.freeShipping,
  };
}

export function ApiProductCard({ product }: { product: ApiCardRow }) {
  return <ProductCard product={apiToCard(product)} />;
}
