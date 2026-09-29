"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Minus, Plus, ShieldCheck, ShoppingCart, Store, Truck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { discountPct, formatSold, formatUSD } from "@/lib/format";
import { RatingStars } from "@/components/commerce/rating-stars";
import { ProductCard } from "@/components/commerce/product-card";
import { getProduct, products } from "@/lib/mocks/catalog";
import { usePublicSettings } from "@/lib/public-settings";
import { useCart } from "@/lib/store/cart";
import { toast } from "sonner";
import { use } from "react";

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [qty, setQty] = useState(1);
  const [color, setColor] = useState(0);
  const add = useCart((s) => s.add);

  // mock sync lookup (client component over static mock)
  const product = products.find((p) => p.slug === slug) ?? products[0];
  const { buyerProtectionText, buyerProtectionDays } = usePublicSettings();
  void getProduct;
  const pct = discountPct(product.price, product.compareAt);
  const related = products.filter((p) => p.slug !== product.slug).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="relative aspect-square bg-neutral-100">
            <Image src={product.image} alt={product.title} fill className="object-cover" priority />
            {pct ? <Badge className="absolute left-3 top-3 bg-ali-sale text-white">-{pct}%</Badge> : null}
          </div>
          <div className="grid grid-cols-4 gap-2 p-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
                <Image src={product.image} alt="" fill className="object-cover" />
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[12px]">
            {product.badge ? <Badge className="bg-orange-100 text-ali-orange">{product.badge}</Badge> : null}
            <span className="text-neutral-500">{formatSold(product.sold)}</span>
          </div>
          <h1 className="text-xl font-semibold leading-6">{product.title}</h1>
          <div className="flex items-center gap-2 text-sm">
            <RatingStars rating={product.rating} />
            <span className="font-semibold">{product.rating.toFixed(1)}</span>
            <Link href="#reviews" className="text-neutral-500 underline">{product.reviews.toLocaleString()} reviews</Link>
          </div>
          <div className="flex items-baseline gap-2 rounded-xl bg-neutral-100 p-3">
            <span className="text-3xl font-black text-ali-red">{formatUSD(product.price)}</span>
            {product.compareAt ? <span className="text-sm text-neutral-400 line-through">{formatUSD(product.compareAt)}</span> : null}
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Color: <span className="font-normal">Variant {color + 1}</span></p>
            <div className="flex gap-2">
              {(product.colors ?? []).map((c, i) => (
                <button
                  key={c + i}
                  onClick={() => setColor(i)}
                  className={`size-9 rounded-full border-2 ${i === color ? "border-ali-red" : "border-neutral-200"}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${i + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold">Quantity</p>
            <div className="flex items-center rounded-full border">
              <Button variant="ghost" size="icon-sm" onClick={() => setQty(Math.max(1, qty - 1))}><Minus /></Button>
              <span className="w-8 text-center text-sm font-bold">{qty}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => setQty(qty + 1)}><Plus /></Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              className="flex-1 bg-ali-red text-white hover:bg-ali-red-dark"
              onClick={() => {
                add(product, qty, `Variant ${color + 1}`);
                toast.success("Added to cart");
              }}
            >
              <ShoppingCart /> Add to cart
            </Button>
            <Button size="lg" variant="outline" className="flex-1 border-ali-red text-ali-red">
              <Zap /> Buy now
            </Button>
            <Button size="icon-lg" variant="outline" aria-label="Wishlist"><Heart /></Button>
          </div>

          <Card>
            <CardContent className="space-y-2 p-4 text-[13px]">
              <p className="flex items-center gap-2"><Truck className="size-4 text-emerald-600" /> {product.freeShipping ? "Free shipping" : "Shipping from $1.99"} · delivery in 7–12 days (mock)</p>
              <p className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" /> Buyer Protection ({buyerProtectionDays} days) · {buyerProtectionText}</p>
              <Link href={`/store/${product.storeSlug}`} className="flex items-center gap-2 pt-1 font-medium">
                <Store className="size-4" /> {product.store} · 97.4% positive
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="description">
        <TabsList>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="specs">Specifications</TabsTrigger>
          <TabsTrigger value="reviews" id="reviews">Reviews ({product.reviews.toLocaleString()})</TabsTrigger>
        </TabsList>
        <TabsContent value="description">
          <Card className="p-4 text-sm text-neutral-600">Mock description. Real content will come from the seller listing + custom backend.</Card>
        </TabsContent>
        <TabsContent value="specs">
          <Card className="p-4 text-sm text-neutral-600">Brand: YS · Model: Mock-001 · Warranty: 12 months (mock).</Card>
        </TabsContent>
        <TabsContent value="reviews">
          <Card className="p-4 text-sm text-neutral-600">Reviews UI mock. Rating breakdown + review list will be paginated from backend.</Card>
        </TabsContent>
      </Tabs>

      <section>
        <h2 className="mb-3 text-lg font-bold">Related products</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {related.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
