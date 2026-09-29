"use client";

import { useQuery } from "@tanstack/react-query";
import { Ticket } from "lucide-react";

type PublicCoupon = {
  code: string;
  type: "PERCENT" | "FIXED" | "FREESHIP";
  summary: string;
  minSubtotal: number | null;
  categories: string[];
};

/** Real list of currently-redeemable coupons for the account tab. */
export function AccountCoupons() {
  const query = useQuery({
    queryKey: ["public-coupons"],
    queryFn: async (): Promise<PublicCoupon[]> => {
      const res = await fetch("/api/v1/coupons");
      if (!res.ok) throw new Error("unavailable");
      return (await res.json()).data as PublicCoupon[];
    },
    staleTime: 60_000,
    retry: 1,
  });

  if (query.isLoading) return <p className="text-sm text-neutral-500">Loading coupons…</p>;
  if (query.isError || !query.data) return <p className="text-sm text-neutral-500">Coupons unavailable right now.</p>;
  if (query.data.length === 0) return <p className="text-sm text-neutral-500">No active coupons right now.</p>;

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {query.data.map((c) => (
        <li key={c.code} className="flex items-center gap-3 rounded-xl border-2 border-dashed border-neutral-200 p-3 dark:border-neutral-800">
          <Ticket className="size-5 shrink-0 text-ali-red" />
          <div className="min-w-0">
            <p className="font-mono text-sm font-black tracking-widest">{c.code}</p>
            <p className="truncate text-xs text-neutral-500">
              {c.summary}
              {c.categories.length > 0 ? ` · ${c.categories.join(", ")}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
