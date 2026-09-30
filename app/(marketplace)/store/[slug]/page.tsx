"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Loader2, Megaphone, RotateCcw, Truck } from "lucide-react";
import { toast } from "sonner";
import { ApiProductCard, type ApiCardRow } from "@/components/commerce/api-product-card";
import { RatingStars } from "@/components/commerce/rating-stars";
import { MessageButton } from "@/components/chat/message-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, readData, readEnvelope } from "@/lib/api/client";
import { formatSold, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type StoreProfile = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  banner: string | null;
  shippingPolicy: string | null;
  returnPolicy: string | null;
  announcement: string | null;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  followerCount: number;
  createdAt: string;
};

type StoreResponse = {
  store: StoreProfile;
  products: ApiCardRow[];
  following: boolean;
  total: number;
  pages: number;
  categories: Array<{ category: string; count: number }>;
};

type StoreReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  verified: boolean;
  createdAt: string;
  author: { name: string | null };
  product: { slug: string; title: string; image: string };
};

async function fetchStore(slug: string, category: string, sort: string, page: number): Promise<StoreResponse> {
  const q = new URLSearchParams({ page: String(page), pageSize: "12" });
  if (category) q.set("category", category);
  if (sort) q.set("sort", sort);
  const envelope = await readEnvelope<{ store: StoreProfile; products: ApiCardRow[]; following: boolean }>(
    await fetch(`/api/v1/stores/${slug}?${q.toString()}`)
  );
  const total = envelope.pagination?.total ?? 0;
  return {
    store: envelope.data.store,
    products: envelope.data.products ?? [],
    following: envelope.data.following,
    total,
    pages: Math.max(1, Math.ceil(total / 12)),
    categories: (envelope.meta?.categories as Array<{ category: string; count: number }>) ?? [],
  };
}

async function fetchStoreReviews(slug: string): Promise<StoreReview[]> {
  return apiGet<StoreReview[]>(`/api/v1/stores/${slug}/reviews?pageSize=10`);
}

function FollowButton({ slug, following, onChange }: { slug: string; following: boolean; onChange: (v: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/stores/${slug}/follow`, { method: following ? "DELETE" : "POST" });
      if (res.status === 401) {
        toast.error("Sign in to follow stores.");
        return;
      }
      const json = await readData<{ following: boolean }>(res);
      onChange(json.following);
      toast.success(json.following ? "Following this store." : "Unfollowed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Follow failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      onClick={toggle}
      disabled={busy}
      variant={following ? "outline" : "default"}
      aria-pressed={following}
      className={cn(!following && "bg-ali-red text-white hover:bg-ali-red-dark")}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Heart className={cn("size-4", following && "fill-current")} />}
      {following ? "Following" : "Follow"}
    </Button>
  );
}

export default function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [followers, setFollowers] = useState<number | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);

  const query = useQuery({
    queryKey: ["store", slug, category, sort, page],
    queryFn: () => fetchStore(slug, category, sort, page),
    retry: false,
  });
  const reviewsQuery = useQuery({
    queryKey: ["store-reviews", slug],
    queryFn: () => fetchStoreReviews(slug),
    retry: false,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-44 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
          ))}
        </div>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Card className="space-y-2 p-10 text-center">
        <p className="text-lg font-bold">Store not found</p>
        <p className="text-sm text-neutral-500">It may be pending approval or suspended.</p>
        <Button asChild className="mt-2"><Link href="/">Back to shopping</Link></Button>
      </Card>
    );
  }

  const { store, products, total, pages, categories } = query.data;
  const isFollowing = following ?? query.data.following;
  const followerCount = followers ?? store.followerCount;
  const reviews = reviewsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        {store.banner ? (
          <div className="relative h-36 w-full sm:h-44">
            <Image src={store.banner} alt="" fill className="object-cover" sizes="100vw" />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-4 p-5">
          {store.logo ? (
            <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl border bg-white">
              <Image src={store.logo} alt={store.name} fill className="object-contain" sizes="64px" />
            </span>
          ) : (
            <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-ali-red text-2xl font-black text-white">
              {store.name.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{store.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-neutral-500">
              <RatingStars rating={store.ratingAvg} />
              <span className="font-semibold text-neutral-700 dark:text-neutral-200">{store.ratingAvg.toFixed(1)}</span>
              <span>({store.ratingCount})</span>
              <span>·</span>
              <span>{formatSold(store.soldCount)}</span>
              <span>·</span>
              <span className="tabular-nums">{followerCount.toLocaleString()} followers</span>
            </p>
            {store.description ? <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{store.description}</p> : null}
          </div>
          <FollowButton
            slug={slug}
            following={isFollowing}
            onChange={(v) => {
              setFollowing(v);
              setFollowers(followerCount + (v ? 1 : -1));
              queryClient.invalidateQueries({ queryKey: ["store", slug] });
            }}
          />
          <MessageButton storeId={store.id} label="Message store" basePath="/account/messages" />
        </div>
        {store.announcement ? (
          <p className="flex items-center gap-2 border-t bg-amber-400/10 px-5 py-2 text-sm">
            <Megaphone className="size-4 shrink-0 text-amber-600" /> {store.announcement}
          </p>
        ) : null}
      </Card>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products ({total})</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({store.ratingCount})</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={category || "all"} onValueChange={(v) => { setCategory(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.category} value={c.category}>{c.category} ({c.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="sold">Best selling</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {products.length === 0 ? (
            <Card className="p-10 text-center text-sm text-neutral-500">No products here yet.</Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {products.map((p) => (
                  <ApiProductCard key={p.slug} product={p} />
                ))}
              </div>
              {pages > 1 ? (
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
                  <span className="tabular-nums">Page {page} of {pages}</span>
                  <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              ) : null}
            </>
          )}
        </TabsContent>
        <TabsContent value="reviews">
          <Card className="px-4 py-1">
            {reviewsQuery.isLoading ? (
              <p className="py-4 text-sm text-neutral-500">Loading reviews…</p>
            ) : reviewsQuery.isError ? (
              // Previously unhandled: a failed fetch rendered "No reviews yet",
              // so a 500 was indistinguishable from an empty store.
              <div className="flex items-center gap-2 py-4">
                <p className="text-sm text-red-600" role="alert">
                  {reviewsQuery.error instanceof Error ? reviewsQuery.error.message : "Couldn't load reviews."}
                </p>
                <Button size="sm" variant="outline" onClick={() => reviewsQuery.refetch()}>Retry</Button>
              </div>
            ) : reviews.length === 0 ? (
              <p className="py-4 text-sm text-neutral-500">No reviews yet.</p>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="border-b py-4 last:border-0">
                  <div className="flex items-center gap-2">
                    <RatingStars rating={r.rating} />
                    {r.verified ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Verified</Badge>
                    ) : null}
                    <span className="ml-auto text-xs text-neutral-400">{timeAgo(r.createdAt)}</span>
                  </div>
                  <Link href={`/product/${r.product.slug}`} className="mt-1 block truncate text-sm font-medium hover:underline">
                    {r.product.title}
                  </Link>
                  {r.title ? <p className="mt-0.5 text-sm font-bold">{r.title}</p> : null}
                  {r.body ? <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-300">{r.body}</p> : null}
                </div>
              ))
            )}
          </Card>
        </TabsContent>
        <TabsContent value="policies">
          <Card className="space-y-4 p-5 text-sm">
            <div>
              <p className="flex items-center gap-1.5 font-bold"><Truck className="size-4" /> Shipping policy</p>
              <p className="mt-1 text-neutral-600 dark:text-neutral-300">{store.shippingPolicy || "Not specified."}</p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 font-bold"><RotateCcw className="size-4" /> Return policy</p>
              <p className="mt-1 text-neutral-600 dark:text-neutral-300">{store.returnPolicy || "Not specified."}</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
