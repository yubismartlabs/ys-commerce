"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BadgePercent, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApiProductCard } from "@/components/commerce/api-product-card";

type Deal = {
  id: string;
  dealPrice: number;
  endsAt: string;
  product: {
    slug: string;
    title: string;
    image: string;
    price: number;
    compareAt: number | null;
    ratingAvg: number;
    ratingCount: number;
    soldCount: number;
    badge: string | null;
    freeShipping: boolean;
  };
};

/** Live flash-deals strip for the homepage (hides when empty). */
export function HomeDeals() {
  const query = useQuery({
    queryKey: ["home-deals"],
    queryFn: async (): Promise<Deal[]> => {
      const res = await fetch("/api/v1/deals?pageSize=8");
      if (!res.ok) throw new Error("deals");
      const now = Date.now();
      return ((await res.json()).data as Deal[]).filter(
        (d) =>
          d.endsAt &&
          new Date(d.endsAt).getTime() > now
      );
    },
    staleTime: 60_000,
    retry: false,
  });
  const rows = query.data ?? [];
  if (!query.isLoading && rows.length === 0) return null;

  return (
    <section>
      <Card className="p-0">
        <CardContent className="flex items-center gap-2 p-4">
          <BadgePercent className="size-5 text-ali-red" />
          <h2 className="text-lg font-extrabold text-ali-red">Flash Deals</h2>
          <Badge variant="secondary">Live now</Badge>
          <Link href="/deals" className="ml-auto inline-flex items-center text-[13px]">
            More <ChevronRight className="size-4" />
          </Link>
        </CardContent>
        <div className="grid grid-cols-2 gap-3 p-4 pt-0 sm:grid-cols-4 lg:grid-cols-8">
          {query.isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
              ))
            : rows.map((d) => (
                <ApiProductCard
                  key={d.id}
                  product={{ ...d.product, price: Number(d.dealPrice), compareAt: Number(d.product.price) }}
                />
              ))}
        </div>
      </Card>
    </section>
  );
}
