"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShieldCheck, ShoppingCart, Store, Truck, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { discountPct, formatSold, formatUSD } from "@/lib/format";
import { RatingStars } from "@/components/commerce/rating-stars";
import { ApiProductCard, type ApiCardRow } from "@/components/commerce/api-product-card";
import { ProductReviews } from "@/components/products/product-reviews";
import { WishlistHeart } from "@/components/products/wishlist-heart";
import { usePublicSettings } from "@/lib/public-settings";
import { useCart } from "@/lib/store/cart";
import { cn } from "@/lib/utils";

type Variant = {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  image: string | null;
  stock: number;
};

type LiveProduct = {
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
  variants: Variant[];
  distribution: Array<{ rating: number; count: number }>;
  related: ApiCardRow[];
  store: { id: string; name: string; slug: string };
  deal: { id: string; dealPrice: number; endsAt: string; stockCap: number | null; soldCount: number } | null;
  viewer: { reviewed: boolean; wishlisted: boolean };
};

async function fetchProduct(slug: string): Promise<LiveProduct> {
  const res = await fetch(`/api/v1/products/${slug}`);
  if (!res.ok) throw new Error("Product not found.");
  const json = await res.json();
  const p = json.data;
  return {
    ...p,
    price: Number(p.price),
    compareAt: p.compareAt === null ? null : Number(p.compareAt),
    variants: (p.variants ?? []).map((v: Variant & { price: unknown }) => ({
      ...v,
      price: v.price === null ? null : Number(v.price),
    })),
  };
}

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const add = useCart((s) => s.add);
  const { buyerProtectionText, buyerProtectionDays } = usePublicSettings();
  const [imgIdx, setImgIdx] = useState(0);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  const query = useQuery({ queryKey: ["product", slug], queryFn: () => fetchProduct(slug), retry: false });

  if (query.isLoading) {
    return (
      <div className="grid animate-pulse gap-4 lg:grid-cols-2">
        <div className="aspect-square rounded-xl bg-neutral-200 dark:bg-neutral-800" />
        <div className="space-y-3">
          <div className="h-6 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-10 w-40 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-12 rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Card className="space-y-2 p-10 text-center">
        <p className="text-lg font-bold">Product not found</p>
        <p className="text-sm text-neutral-500">It may be sold out or taken down.</p>
        <Button asChild className="mt-2"><Link href="/">Back to shopping</Link></Button>
      </Card>
    );
  }

  const product = query.data;
  const gallery = product.images.length > 0 ? product.images : [product.image];
  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const basePrice = product.deal ? Number(product.deal.dealPrice) : product.price;
  const price = variant?.price ?? basePrice;
  const compareAt = !variant ? (product.deal ? product.price : product.compareAt) : null;
  const pct = discountPct(price, compareAt ?? undefined);
  const stock = variant ? variant.stock : null;
  const maxQty = stock !== null ? Math.max(1, Math.min(stock, 99)) : 99;
  const mainImg = variant?.image ?? gallery[Math.min(imgIdx, gallery.length - 1)];

  const addToCart = () => {
    add(
      { slug: product.slug, title: product.title, image: mainImg, price },
      Math.min(qty, maxQty),
      variant?.name
    );
    toast.success("Added to cart");
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="relative aspect-square bg-neutral-100">
            <Image src={mainImg} alt={product.title} fill className="object-cover" priority sizes="(max-width: 1024px) 100vw, 50vw" />
            {pct ? <Badge className="absolute left-3 top-3 bg-ali-sale text-white">-{pct}%</Badge> : null}
          </div>
          {gallery.length > 1 ? (
            <div className="grid grid-cols-4 gap-2 p-3">
              {gallery.map((g, i) => (
                <button
                  key={g + i}
                  onClick={() => setImgIdx(i)}
                  className={cn("relative aspect-square overflow-hidden rounded-lg bg-neutral-100 ring-2 ring-offset-1", i === imgIdx ? "ring-ali-red" : "ring-transparent")}
                >
                  <Image src={g} alt="" fill className="object-cover" sizes="120px" />
                </button>
              ))}
            </div>
          ) : null}
        </Card>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[12px]">
            {product.badge ? <Badge className="bg-orange-100 text-ali-orange">{product.badge}</Badge> : null}
            <span className="text-neutral-500">{formatSold(product.soldCount)}</span>
          </div>
          <h1 className="text-xl font-semibold leading-6">{product.title}</h1>
          <div className="flex items-center gap-2 text-sm">
            <RatingStars rating={product.ratingAvg} />
            <span className="font-semibold">{product.ratingAvg.toFixed(1)}</span>
            <a href="#reviews" className="text-neutral-500 underline">{product.ratingCount.toLocaleString()} reviews</a>
          </div>
          <div className="flex items-baseline gap-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
            <span className="text-3xl font-black text-ali-red">{formatUSD(price)}</span>
            {compareAt ? <span className="text-sm text-neutral-400 line-through">{formatUSD(compareAt)}</span> : null}
          </div>
          {product.deal ? (
            <p className="flex items-center gap-2 rounded-lg bg-ali-red/10 px-3 py-2 text-sm font-bold text-ali-red">
              <Zap className="size-4 fill-current" />
              Flash deal ends {new Date(product.deal.endsAt).toLocaleString()}
              {product.deal.stockCap ? ` · ${Math.max(0, product.deal.stockCap - product.deal.soldCount)} left` : ""}
            </p>
          ) : null}

          {product.variants.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-semibold">
                Option: <span className="font-normal">{variant ? variant.name : `Select (${product.variants.length})`}</span>
                {stock !== null ? <span className={cn("ml-2 text-xs font-normal", stock === 0 ? "text-red-600" : "text-neutral-500")}>{stock === 0 ? "Out of stock" : `${stock} in stock`}</span> : null}
              </p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => { setVariantId(v.id); setQty(1); }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border-2 px-2.5 py-1.5 text-sm",
                      v.id === variantId ? "border-ali-red" : "border-neutral-200 dark:border-neutral-700"
                    )}
                  >
                    {v.image ? (
                      <span className="relative size-8 overflow-hidden rounded-md bg-neutral-100">
                        <Image src={v.image} alt="" fill className="object-cover" sizes="32px" />
                      </span>
                    ) : null}
                    <span>{v.name}</span>
                    {v.price !== null && v.price !== product.price ? (
                      <span className="font-bold text-ali-red">{formatUSD(v.price)}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold">Quantity</p>
            <div className="flex items-center rounded-full border">
              <Button variant="ghost" size="icon-sm" onClick={() => setQty(Math.max(1, qty - 1))}><Minus /></Button>
              <span className="w-8 text-center text-sm font-bold">{Math.min(qty, maxQty)}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => setQty(Math.min(maxQty, qty + 1))}><Plus /></Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="lg" className="flex-1 bg-ali-red text-white hover:bg-ali-red-dark" disabled={stock === 0} onClick={addToCart}>
              <ShoppingCart /> Add to cart
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1 border-ali-red text-ali-red"
              disabled={stock === 0}
              onClick={() => { addToCart(); router.push("/checkout"); }}
            >
              <Zap /> Buy now
            </Button>
            <WishlistHeart slug={product.slug} wishlisted={product.viewer.wishlisted} queryKey={["product", slug]} />
          </div>

          <Card>
            <CardContent className="space-y-2 p-4 text-[13px]">
              <p className="flex items-center gap-2"><Truck className="size-4 text-emerald-600" /> {product.freeShipping ? "Free shipping" : "Shipping from $1.99"} · delivery in 7–12 days</p>
              <p className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" /> Buyer Protection ({buyerProtectionDays} days) · {buyerProtectionText}</p>
              <Link href={`/store/${product.store.slug}`} className="flex items-center gap-2 pt-1 font-medium">
                <Store className="size-4" /> {product.store.name} · {product.ratingAvg.toFixed(1)} ★
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="description">
        <TabsList>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="specs">Specifications</TabsTrigger>
          <TabsTrigger value="reviews" id="reviews">Reviews ({product.ratingCount.toLocaleString()})</TabsTrigger>
        </TabsList>
        <TabsContent value="description">
          <Card className="p-4 text-sm text-neutral-600 dark:text-neutral-300">
            {product.description || "No description yet."}
          </Card>
        </TabsContent>
        <TabsContent value="specs">
          <Card className="p-4 text-sm">
            {product.specs.length === 0 ? (
              <p className="text-neutral-500">No specifications listed.</p>
            ) : (
              <dl className="divide-y">
                {product.specs.map((s) => (
                  <div key={s.k} className="grid grid-cols-[160px_1fr] gap-2 py-2">
                    <dt className="text-neutral-500">{s.k}</dt>
                    <dd>{s.v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="reviews">
          <Card className="p-4">
            <ProductReviews
              slug={product.slug}
              avg={product.ratingAvg}
              count={product.ratingCount}
              distribution={product.distribution}
              canReview={!query.data.viewer.reviewed}
            />
          </Card>
        </TabsContent>
      </Tabs>

      {product.related.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-bold">Related products</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {product.related.map((p) => (
              <ApiProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
