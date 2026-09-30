"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShieldCheck, ShoppingCart, Sparkles, Store, Truck, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { discountPct, formatSold, formatUSD } from "@/lib/format";
import { RatingStars } from "@/components/commerce/rating-stars";
import { ApiProductCard } from "@/components/commerce/api-product-card";
import { ProductReviews } from "@/components/products/product-reviews";
import { ProductQuestions } from "@/components/products/product-questions";
import { PriceHistory } from "@/components/products/price-history";
import { WishlistHeart } from "@/components/products/wishlist-heart";
import { MessageButton } from "@/components/chat/message-button";
import { useAssistant } from "@/lib/store/assistant";
import { usePublicSettings } from "@/lib/public-settings";
import { useCart } from "@/lib/store/cart";
import { cn } from "@/lib/utils";
import type { ProductDetail } from "@/lib/products/detail";

/**
 * Interactive half of the product page. The route itself is a server
 * component so it can call notFound() and emit metadata; everything that needs
 * state or browser APIs lives here.
 */
export function ProductView({ product, shippingFee }: { product: ProductDetail; shippingFee: number }) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const openWith = useAssistant((s) => s.openWith);
  const { buyerProtectionText, buyerProtectionDays, etaText, shipFrom, aiEnabled } = usePublicSettings();
  const [imgIdx, setImgIdx] = useState(0);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  const hasVariants = product.variants.length > 0;
  const gallery = product.images.length > 0 ? product.images : [product.image];
  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const needsVariant = hasVariants && !variant;
  const basePrice = product.deal ? product.deal.dealPrice : product.price;
  const price = variant?.price ?? basePrice;
  const compareAt = !variant ? (product.deal ? product.price : product.compareAt) : null;
  const pct = discountPct(price, compareAt ?? undefined);
  // Effective availability: the chosen option's stock, or the listing's own
  // stock when the product has no variants and tracks stock.
  const productSoldOut = product.trackStock && product.variants.length === 0 && product.stock <= 0;
  const stock = variant ? variant.stock : product.trackStock && product.variants.length === 0 ? product.stock : null;
  const soldOut = productSoldOut || stock === 0;
  const maxQty = stock !== null ? Math.max(1, Math.min(stock, 99)) : 99;
  const mainImg = variant?.image && variant.image !== "/placeholder-product.svg" ? variant.image : gallery[Math.min(imgIdx, gallery.length - 1)];

  const addToCart = () => {
    add(
      {
        slug: product.slug,
        title: product.title,
        image: mainImg,
        price,
        storeId: product.store.id,
        storeName: product.store.name,
        ...(product.store.slug ? { storeSlug: product.store.slug } : {}),
        freeShipping: product.freeShipping,
      },
      Math.min(qty, maxQty),
      variant?.name
    );
    toast.success("Added to cart");
  };

  const buyNow = () => {
    addToCart();
    router.push("/checkout");
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="relative aspect-square bg-neutral-100">
            <Image
              src={mainImg}
              alt={product.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            {pct ? <Badge className="absolute left-3 top-3 bg-ali-sale text-white">-{pct}%</Badge> : null}
          </div>
          {gallery.length > 1 ? (
            <div className="grid grid-cols-4 gap-2 p-3">
              {gallery.map((g, i) => (
                <button
                  key={g + i}
                  onClick={() => setImgIdx(i)}
                  aria-label={`View image ${i + 1} of ${gallery.length}`}
                  aria-pressed={i === imgIdx}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-lg bg-neutral-100 ring-2 ring-offset-1",
                    i === imgIdx ? "ring-ali-red" : "ring-transparent"
                  )}
                >
                  <Image src={g} alt="" fill className="object-cover" sizes="120px" />
                </button>
              ))}
            </div>
          ) : null}
        </Card>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[12px]">
            {product.badge ? <Badge className="bg-orange-100 text-ali-orange-ink">{product.badge}</Badge> : null}
            <span className="text-neutral-500">{formatSold(product.soldCount)} sold</span>
          </div>
          <h1 className="text-xl font-semibold leading-6">{product.title}</h1>
          <div className="flex items-center gap-2 text-sm">
            <RatingStars rating={product.ratingAvg} />
            <span className="font-semibold">{product.ratingAvg.toFixed(1)}</span>
            <a href="#reviews" className="text-neutral-500 underline">{product.ratingCount.toLocaleString()} reviews</a>
          </div>
          <div className="flex items-baseline gap-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
            <span className="text-3xl font-black text-ali-red">{formatUSD(price)}</span>
            {compareAt ? <span className="text-sm text-neutral-500 line-through">{formatUSD(compareAt)}</span> : null}
          </div>
          <PriceHistory slug={product.slug} />
          {product.deal ? (
            <p className="flex flex-wrap items-center gap-2 rounded-lg bg-ali-red/10 px-3 py-2 text-sm font-bold text-ali-red">
              <Zap className="size-4 fill-current" />
              Flash deal ends {new Date(product.deal.endsAt).toLocaleString()}
              {product.deal.stockCap ? ` · ${Math.max(0, product.deal.stockCap - product.deal.soldCount)} left` : ""}
            </p>
          ) : null}

          {hasVariants ? (
            <div>
              <p className="mb-2 text-sm font-semibold" id="variant-label">
                Option:{" "}
                <span className="font-normal">
                  {variant ? variant.name : `Select (${product.variants.length})`}
                </span>
                {stock !== null || productSoldOut ? (
                  <span className={cn("ml-2 text-xs font-normal", stock === 0 ? "text-red-600" : "text-neutral-500")}>
                    {productSoldOut ? "Out of stock" : stock === 0 ? "Out of stock" : `${stock} in stock`}
                  </span>
                ) : null}
              </p>
              {/* Toggle buttons rather than a partial radiogroup: these don't
                  implement arrow-key roving focus, and announcing "radio
                  group" without it misleads screen-reader users. */}
              <div className="flex flex-wrap gap-2" aria-labelledby="variant-label">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    aria-pressed={v.id === variantId}
                    disabled={v.stock === 0}
                    onClick={() => {
                      setVariantId(v.id);
                      setQty(1);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border-2 px-2.5 py-1.5 text-sm disabled:opacity-50",
                      v.id === variantId ? "border-ali-red bg-ali-red/5" : "border-neutral-200 dark:border-neutral-700"
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
              {needsVariant ? (
                <p className="mt-1.5 text-xs text-neutral-500">Select an option above to add to cart.</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold" id="qty-label">Quantity</p>
            <div className="flex items-center rounded-full border" aria-labelledby="qty-label">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Decrease quantity"
                onClick={() => setQty(Math.max(1, qty - 1))}
              ><Minus /></Button>
              <span className="w-8 text-center text-sm font-bold" aria-live="polite">{Math.min(qty, maxQty)}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Increase quantity"
                onClick={() => setQty(Math.min(maxQty, qty + 1))}
              ><Plus /></Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              className="flex-1 bg-ali-red text-white hover:bg-ali-red-dark"
              disabled={soldOut || needsVariant}
              onClick={addToCart}
            >
              <ShoppingCart /> Add to cart
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1 border-ali-red text-ali-red"
              disabled={soldOut || needsVariant}
              onClick={buyNow}
            >
              <Zap /> Buy now
            </Button>
            <WishlistHeart
              slug={product.slug}
              wishlisted={product.viewer.wishlisted}
              queryKey={["product", product.slug]}
            />
          </div>

          <Card>
            <CardContent className="space-y-2 p-4 text-[13px]">
              <p className="flex flex-wrap items-center gap-2">
                <Truck className="size-4 shrink-0 text-emerald-600" />
                {product.freeShipping ? "Free shipping" : `Shipping from $${shippingFee.toFixed(2)}`}
                {shipFrom ? ` · Ships from ${shipFrom}` : ""}
                {etaText ? ` · ${etaText}` : ""}
              </p>
              <p className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600" /> Buyer Protection ({buyerProtectionDays} days) ·{" "}
                {buyerProtectionText}
              </p>
              <Link href={`/store/${product.store.slug}`} className="flex items-center gap-2 pt-1 font-medium">
                <Store className="size-4" /> {product.store.name} · {product.store.ratingAvg.toFixed(1)} ★
              </Link>
              <MessageButton productId={product.id} label="Ask about this product" basePath="/account/messages" />
              {aiEnabled ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openWith({ productSlug: product.slug })}
                  className="gap-1.5 border-ali-red text-ali-red"
                >
                  <Sparkles className="size-3.5" /> Ask AI about this product
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="description">
        <TabsList>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="specs">Specifications</TabsTrigger>
          <TabsTrigger value="questions">Q&amp;A</TabsTrigger>
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
        <TabsContent value="questions">
          <ProductQuestions slug={product.slug} />
        </TabsContent>
        <TabsContent value="reviews">
          <Card className="p-4">
            <ProductReviews
              slug={product.slug}
              avg={product.ratingAvg}
              count={product.ratingCount}
              distribution={product.distribution}
              canReview={!product.viewer.reviewed}
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
