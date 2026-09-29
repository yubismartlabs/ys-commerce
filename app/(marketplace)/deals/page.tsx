"use client";

import { useQuery } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { ApiProductCard } from "@/components/commerce/api-product-card";
import { Card } from "@/components/ui/card";
import { formatUSD } from "@/lib/format";

type DealRow = {
  id: string;
  dealPrice: number;
  startsAt: string;
  endsAt: string;
  stockCap: number | null;
  soldCount: number;
  live: boolean;
  progress: number | null;
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

function countdown(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 48) return `${Math.floor(h / 24)}d left`;
  return `${h}h ${m}m left`;
}

export default function DealsPage() {
  const query = useQuery({
    queryKey: ["deals"],
    queryFn: async (): Promise<DealRow[]> => {
      const res = await fetch("/api/v1/deals?pageSize=48");
      if (!res.ok) throw new Error("Couldn't load deals.");
      return (await res.json()).data as DealRow[];
    },
  });
  const rows = (query.data ?? []).filter((d) => d.live);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl bg-gradient-to-r from-[#e62e1b] to-[#ff6a00] p-6 text-white">
        <p className="flex items-center gap-2 text-2xl font-black"><Zap className="size-6 fill-current" /> Flash Deals</p>
        <p className="mt-1 text-sm text-white/85">Curated drops at AliExpress-style prices. When the cap fills or time runs out, prices snap back.</p>
      </div>

      {query.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
          ))}
        </div>
      ) : query.isError ? (
        <Card className="p-10 text-center text-sm text-neutral-500">Couldn&apos;t load deals.</Card>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-neutral-500">No live deals right now — check back soon.</Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {rows.map((d) => (
            <div key={d.id} className="space-y-1">
              <ApiProductCard
                product={{
                  ...d.product,
                  price: Number(d.dealPrice),
                  compareAt: Number(d.product.price),
                }}
              />
              <div className="rounded-lg bg-ali-red/5 px-2.5 py-1.5 text-xs">
                <p className="flex items-center justify-between font-bold text-ali-red">
                  <span>{formatUSD(Number(d.dealPrice))}</span>
                  <span className="font-medium">{countdown(d.endsAt)}</span>
                </p>
                {d.progress !== null && d.stockCap ? (
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                    <span className="block h-full rounded-full bg-ali-red" style={{ width: `${Math.round(d.progress * 100)}%` }} />
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
