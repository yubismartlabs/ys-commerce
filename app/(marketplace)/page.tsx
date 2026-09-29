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
import { categories, products } from "@/lib/mocks/catalog";

const heroSlides = [
  { title: "Mega Flash Deals", sub: "Up to -70% · Free shipping", bg: "bg-gradient-to-r from-[#e62e1b] to-[#ff6a00]", seed: "hero-1" },
  { title: "Choice Day", sub: "Top-rated picks from $0.99", bg: "bg-gradient-to-r from-[#7c2d12] to-[#e62e1b]", seed: "hero-2" },
  { title: "New Seller Boost", sub: "Open your store in minutes", bg: "bg-gradient-to-r from-neutral-900 to-[#e62e1b]", seed: "hero-3" },
];

export default function HomePage() {
  const flash = products.slice(0, 8);
  const choice = products.slice(8);

  return (
    <div className="space-y-6">
      {/* hero + side promos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2 p-0">
          <Carousel className="w-full">
            <CarouselContent>
              {heroSlides.map((s) => (
                <CarouselItem key={s.seed}>
                  <div className={`${s.bg} relative flex h-56 items-center overflow-hidden px-8 text-white md:h-64`}>
                    <div>
                      <Badge className="mb-2 bg-white/20 text-white">ys-commerce</Badge>
                      <h1 className="text-3xl font-black md:text-4xl">{s.title}</h1>
                      <p className="mt-1 text-white/90">{s.sub}</p>
                      <Button asChild className="mt-4 bg-white text-ali-red hover:bg-white/90">
                        <Link href="/search">Shop now</Link>
                      </Button>
                    </div>
                    <Image
                      src={`https://picsum.photos/seed/${s.seed}/500/400`}
                      alt={s.title}
                      width={320}
                      height={260}
                      className="ml-auto hidden rounded-xl object-cover md:block"
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
            <p className="mt-1 text-[13px] text-white/80">One account to buy and sell. 5% commission in UI mock.</p>
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
        <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
          {categories.map((c) => (
            <Link key={c.slug} href={`/search?category=${c.slug}`} className="group">
              <Card className="p-3 text-center transition group-hover:shadow-md">
                <Image src={c.image} alt={c.label} width={80} height={80} className="mx-auto rounded-full object-cover" />
                <p className="mt-2 line-clamp-2 text-[12px] font-medium">{c.label}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* flash deals */}
      <HomeDeals />

      {/* choice feed */}
      <section>
        <h2 className="mb-3 text-lg font-bold">More to love</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...choice, ...flash].map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
