"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartHandshake, Store } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RatingStars } from "@/components/commerce/rating-stars";
import { storeUrl } from "@/lib/stores/url";
import { readEnvelope } from "@/lib/api/client";

type FollowedStore = {
  id: string;
  name: string;
  slug: string;
  username: string | null;
  logo: string | null;
  ratingAvg: number;
  ratingCount: number;
  followerCount: number;
  status: string;
  followedAt: string;
};

const PAGE_SIZE = 20;

export default function FollowingPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["account-following", page],
    queryFn: async (): Promise<{ rows: FollowedStore[]; total: number }> => {
      const res = await fetch(`/api/v1/account/following?page=${page}&pageSize=${PAGE_SIZE}`);
      if (res.status === 401) throw new Error("Sign in to see stores you follow.");
      const envelope = await readEnvelope<FollowedStore[]>(res);
      return { rows: envelope.data ?? [], total: envelope.pagination?.total ?? 0 };
    },
    retry: false,
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const unfollow = async (slug: string) => {
    setBusy(slug);
    try {
      const res = await fetch(`/api/v1/stores/${encodeURIComponent(slug)}/follow`, { method: "DELETE" });
      if (!res.ok) throw new Error("Unfollow failed.");
      toast.success("Unfollowed.");
      queryClient.invalidateQueries({ queryKey: ["account-following"] });
    } catch {
      toast.error("Unfollow failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <HeartHandshake className="size-5" /> Following ({total})
      </h2>
      <Card className="p-4">
        {query.isLoading ? (
          <p className="py-4 text-center text-sm text-neutral-500">Loading…</p>
        ) : query.isError ? (
          <p className="py-4 text-center text-sm text-red-600" role="alert">{query.error.message}</p>
        ) : rows.length === 0 ? (
          <div className="space-y-2 py-6 text-center text-sm text-neutral-500">
            <Store className="mx-auto size-8 text-neutral-300" />
            <p>You don&apos;t follow any stores yet.</p>
            <p className="text-xs">Follow a store to get its deals and new arrivals — find sellers on any product or store page.</p>
            <Button size="sm" variant="outline" asChild><Link href="/">Discover products</Link></Button>
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                {s.logo ? (
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-xl border bg-white">
                    <Image src={s.logo} alt="" fill sizes="44px" className="object-contain" />
                  </span>
                ) : (
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ali-red text-lg font-black text-white">
                    {s.name.slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <Link href={storeUrl(s)} className="line-clamp-1 text-sm font-bold hover:underline">
                    {s.name}
                  </Link>
                  <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <RatingStars rating={s.ratingAvg} />
                    <span className="tabular-nums">{s.followerCount.toLocaleString()} followers</span>
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled={busy === s.slug} onClick={() => unfollow(s.slug)}>
                  {busy === s.slug ? "…" : "Unfollow"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {pages > 1 ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
          <span className="tabular-nums">Page {page} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      ) : null}
    </div>
  );
}
