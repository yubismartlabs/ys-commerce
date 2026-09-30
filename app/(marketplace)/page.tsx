import Link from "next/link";
import Image from "next/image";
import { Flame, Truck, ShieldCheck, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { ProductCard } from "@/components/commerce/product-card";
import { HomeDeals } from "@/components/deals/home-deals";
import { bestSellingProducts, categoryCounts, newestProducts } from "@/lib/products/feed";
import { CATEGORIES, categoryHref } from "@/lib/categories";
import { getSettingGroup } from "@/lib/server-settings";

const heroSlides = [
  { title: "Mega Flash Deals", sub: "Up to -70% · Free shipping", bg: "bg-gradient-to-r from-[#e62e1b] to-[#ff6a00]", seed: "hero-1" },
  { title: "Choice Day", sub: "Top-rated picks from $0.99", bg: "bg-gradient-to-r from-[#7c2d12] to-[#e62e1b]", seed: "hero-2" },
  { title: "New Seller Boost", sub: "Open your store in minutes", bg: "bg-gradient-to-r from-neutral-900 to-[#e62e1b]", seed: "hero-3" },
];

// The storefront shell renders on every request, so a feed hiccup should
// degrade to an empty section rather than take the homepage down.
async function safely<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[home] ${label} failed:`, e);
    return fallback;
  }
}

export default async function HomePage() {
  const [best, fresh, counts, site] = await Promise.all([
    safely("best sellers", () => bestSellingProducts(20), []),
    safely("newest", () => newestProducts(10), []),
    safely("categories", () => categoryCounts(), {} as Record<string, number>),
    safely("site settings", () => getSettingGroup("site"), null),
  ]);
  const siteName = site?.siteName || "ys-commerce";

  // De-dupe: the "fresh" rail can overlap the best-seller grid.
  const bestSlugs = new Set(best.map((p) => p.slug));
  const feed = [...best, ...fresh.filter((p) => !bestSlugs.has(p.slug))];

  return (
    <div className="space-y-6">
      {/* The three hero slides rotate through the viewport, so they can't own
          the page h1. One hidden heading gives assistive tech a page title. */}
      <h1 className="sr-only">{siteName} — multi-vendor marketplace</h1>

      {/* hero + side promos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2 p-0">
          <Carousel className="w-full">
            <CarouselContent>
              {heroSlides.map((s) => (
                <CarouselItem key={s.seed}>
                  <div className={`${s.bg} relative flex h-56 items-center overflow-hidden px-6 text-white md:h-64 md:px-8`}>
                    <div className="min-w-0 flex-1">
                      <Badge className="mb-2 bg-white/20 text-white">{siteName}</Badge>
                      <h2 className="text-2xl font-black md:text-4xl">{s.title}</h2>
                      <p className="mt-1 text-sm text-white/90 md:text-base">{s.sub}</p>
                      <Button asChild className="mt-4 bg-white text-ali-red hover:bg-white/90">
                        <Link href="/deals">Shop now</Link>
                      </Button>
                    </div>
                    <Image
                      src={`https://picsum.photos/seed/${s.seed}/500/400`}
                      alt=""
                      width={320}
                      height={260}
                      className="ml-4 hidden w-40 shrink-0 rounded-xl object-cover sm:block md:w-80"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-2" />
            <CarouselNext className="right-2" />
          </Carousel>
        </Card>
        <div className="grid gap-4">
          <Card className="bg-white p-4">
            <p className="text-sm font-bold">Buyer Protection</p>
            <p className="mt-1 flex items-center gap-1 text-[13px] text-neutral-600">
              <ShieldCheck className="size-4 text-emerald-600" /> Full refund if your order doesn&apos;t arrive
            </p>
            <p className="mt-1 flex items-center gap-1 text-[13px] text-neutral-600">
              <Truck className="size-4 text-emerald-600" /> Free shipping on Choice items
            </p>
          </Card>
          <Card className="bg-neutral-900 p-4 text-white">
            <p className="flex items-center gap-1 text-sm font-bold"><Flame className="size-4 text-ali-orange" /> Sell on YS</p>
            <p className="mt-1 text-[13px] text-white/80">One account to buy and sell. 5% commission.</p>
            <Button asChild size="sm" className="mt-3 bg-ali-red text-white hover:bg-ali-red-dark">
              <Link href="/selling/onboarding">Open a store</Link>
            </Button>
          </Card>
        </div>
      </div>

      {/* categories */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Shop by category</h2>
          <Link href="/search" className="inline-flex items-center text-[13px] text-neutral-500">
            View all <ChevronRight className="size-4" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-8">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} href={categoryHref(c.slug)} className="group">
              <Card className="p-3 text-center transition group-hover:shadow-md">
                <Image
                  src={c.image}
                  alt=""
                  width={80}
                  height={80}
                  className="mx-auto rounded-full object-cover"
                />
                <p className="mt-2 line-clamp-2 text-[12px] font-medium">{c.label}</p>
                {counts[c.slug] ? (
                  <p className="text-[11px] text-neutral-500 tabular-nums">{counts[c.slug]} items</p>
                ) : null}
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* flash deals */}
      <HomeDeals />

      {/* main feed */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">More to love</h2>
          <Link href="/search?sort=sold" className="inline-flex items-center text-[13px] text-neutral-500">
            See all <ChevronRight className="size-4" />
          </Link>
        </div>
        {feed.length === 0 ? (
          <Card className="space-y-2 p-10 text-center text-sm text-neutral-500">
            <p>No products are listed yet.</p>
            <Button asChild size="sm" className="bg-ali-red text-white hover:bg-ali-red-dark">
              <Link href="/selling/onboarding">Become a seller</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {feed.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
