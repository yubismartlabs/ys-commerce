import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { discountPct, formatSold, formatUSD } from "@/lib/format";
import { RatingStars } from "./rating-stars";
import { cn } from "@/lib/utils";

/** Minimal card fields — satisfied by both mock catalog rows and API products. */
export type CardProduct = {
  slug: string;
  title: string;
  image: string;
  price: number;
  compareAt?: number;
  rating: number;
  reviews: number;
  sold: number;
  badge?: string | null;
  freeShipping: boolean;
};

export function ProductCard({ product }: { product: CardProduct }) {
  const pct = discountPct(product.price, product.compareAt);
  return (
    <Link href={`/product/${product.slug}`} className="group">
      <Card className="overflow-hidden rounded-xl border-transparent bg-white shadow-none transition hover:shadow-lg hover:border-black/5 p-0 gap-0">
        <div className="relative aspect-square overflow-hidden bg-neutral-100">
          <Image
            src={product.image}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
          {pct ? (
            <Badge className="absolute left-2 top-2 rounded-md bg-ali-sale px-1.5 text-[11px] font-bold text-white">
              -{pct}%
            </Badge>
          ) : null}
          {product.badge ? (
            <Badge
              variant="secondary"
              className={cn(
                "absolute right-2 top-2 rounded-md px-1.5 text-[11px] font-semibold",
                product.badge === "Choice" && "bg-orange-100 text-ali-orange-ink"
              )}
            >
              {product.badge}
            </Badge>
          ) : null}
        </div>
        <CardContent className="space-y-1 p-2.5">
          <p className="line-clamp-2 min-h-8 text-[13px] leading-4 text-neutral-800">{product.title}</p>
          <div className="flex items-center gap-1 text-[11px] text-neutral-500">
            <RatingStars rating={product.rating} />
            <span>{product.rating.toFixed(1)}</span>
            <span>·</span>
            <span>{formatSold(product.sold)}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-ali-red">{formatUSD(product.price)}</span>
            {product.compareAt ? (
              <span className="text-[11px] text-neutral-400 line-through">{formatUSD(product.compareAt)}</span>
            ) : null}
          </div>
          {product.freeShipping ? (
            <p className="text-[11px] font-medium text-emerald-600">Free shipping</p>
          ) : (
            <p className="text-[11px] text-neutral-400">Shipping from $1.99</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
