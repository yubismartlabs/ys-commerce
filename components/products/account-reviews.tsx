"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RatingStars } from "@/components/commerce/rating-stars";
import { Pager } from "@/components/refine/ui";
import { readEnvelope } from "@/lib/api/client";
import { timeAgo } from "@/lib/format";
import { useAccountUrl } from "@/lib/account-url";

type MyReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  verified: boolean;
  helpful: number;
  replyBody: string | null;
  createdAt: string;
  product: { slug: string; title: string; image: string };
};

const PAGE_SIZE = 10;

/** The buyer's own written reviews, with seller replies. */
export function AccountReviewsTab() {
  const a = useAccountUrl();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["account-reviews", page],
    queryFn: async (): Promise<{ rows: MyReview[]; total: number }> => {
      const envelope = await readEnvelope<MyReview[]>(
        await fetch(`/api/v1/account/reviews?page=${page}&pageSize=${PAGE_SIZE}`)
      );
      return { rows: envelope.data ?? [], total: envelope.pagination?.total ?? 0 };
    },
    retry: false,
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (query.isLoading) return <p className="text-sm text-neutral-500">Loading your reviews…</p>;
  if (query.isError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {query.error instanceof Error ? query.error.message : "Couldn't load reviews."}
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="space-y-2 py-4 text-sm text-neutral-500">
        <p>You haven&apos;t written a review yet. Reviews unlock after delivery and help other buyers.</p>
        <Button size="sm" variant="outline" asChild><Link href={a("/orders")}>View my orders</Link></Button>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className="py-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <Link href={`/product/${r.product.slug}`} className="line-clamp-1 text-sm font-bold hover:underline">
                  {r.product.title}
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <RatingStars rating={r.rating} />
                  {r.verified ? (
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      Verified purchase
                    </span>
                  ) : null}
                  <span className="text-xs text-neutral-500">
                    {timeAgo(r.createdAt)} · {r.helpful} found this helpful
                  </span>
                </div>
                {r.title ? <p className="mt-1.5 text-sm font-semibold">{r.title}</p> : null}
                {r.body ? <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{r.body}</p> : null}
                {r.replyBody ? (
                  <div className="mt-2 rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
                    <span className="font-semibold">Seller replied: </span>
                    {r.replyBody}
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {pages > 1 ? <Pager page={page} pageCount={pages} total={total} onPage={setPage} /> : null}
    </>
  );
}
