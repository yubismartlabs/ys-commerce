"use client";

import { useState } from "react";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RatingStars } from "@/components/commerce/rating-stars";
import { readData, readEnvelope } from "@/lib/api/client";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  images: string[];
  verified: boolean;
  helpful: number;
  voted: boolean;
  replyBody: string | null;
  replyAt: string | null;
  createdAt: string;
  author: { name: string | null };
};

async function fetchReviews(slug: string, sort: string, page: number): Promise<{ data: ReviewRow[]; total: number; pages: number }> {
  const res = await fetch(`/api/v1/products/${slug}/reviews?sort=${sort}&page=${page}&pageSize=5`);
  const envelope = await readEnvelope<ReviewRow[]>(res);
  const total = envelope.pagination?.total ?? envelope.data.length;
  return { data: envelope.data ?? [], total, pages: Math.max(1, Math.ceil(total / 5)) };
}

function ReviewCard({ slug, review }: { slug: string; review: ReviewRow }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [voted, setVoted] = useState(review.voted);
  const [helpful, setHelpful] = useState(review.helpful);

  const vote = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/reviews/${review.id}/helpful`, { method: "POST" });
      if (res.status === 401) {
        toast.error("Sign in to vote.");
        return;
      }
      const updated = await readData<{ voted: boolean; helpful: number }>(res);
      setVoted(updated.voted);
      setHelpful(updated.helpful);
      queryClient.invalidateQueries({ queryKey: ["reviews", slug] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vote failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b py-4 last:border-0">
      <div className="flex items-center gap-2">
        <RatingStars rating={review.rating} />
        {review.verified ? (
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
            Verified purchase
          </span>
        ) : null}
        <span className="ml-auto text-xs text-neutral-400">{timeAgo(review.createdAt)}</span>
      </div>
      {review.title ? <p className="mt-1.5 text-sm font-bold">{review.title}</p> : null}
      {review.body ? <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{review.body}</p> : null}
      {/* Buyer photos: the API has always accepted and stored these, but the
          card never rendered them, so they were invisible on the storefront. */}
      {review.images.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {review.images.map((src, i) => (
            <li key={`${src}-${i}`}>
              <a href={src} target="_blank" rel="noreferrer noopener" className="block">
                <span className="relative block size-16 overflow-hidden rounded-lg bg-neutral-100">
                  <Image src={src} alt={`Photo ${i + 1} from ${review.author.name ?? "a buyer"}'s review`} fill sizes="64px" className="object-cover" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-1 text-xs text-neutral-500">by {review.author.name ?? "Anonymous"}</p>
      {review.replyBody ? (
        <div className="mt-2 rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Seller response</p>
          <p className="mt-0.5">{review.replyBody}</p>
        </div>
      ) : null}
      <Button size="sm" variant="ghost" disabled={busy} onClick={vote} className={cn("mt-1.5 gap-1.5 text-xs", voted && "text-ali-red")}>
        <ThumbsUp className="size-3.5" /> Helpful ({helpful})
      </Button>
    </div>
  );
}

function WriteReview({ slug, onDone }: { slug: string; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/products/${slug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, title: title || undefined, body: body || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Submit failed.");
      toast.success("Review posted.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-xl border p-4">
      <p className="text-sm font-bold">Write a review</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
            <Star className={cn("size-6", n <= rating ? "fill-amber-400 text-amber-400" : "text-neutral-300")} />
          </button>
        ))}
        <span className="ml-1 text-sm font-bold">{rating}.0</span>
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Headline (optional)" maxLength={120} />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you think?" rows={3} maxLength={2000} />
      <div>
        <Button type="submit" size="sm" disabled={saving} className="bg-ali-red text-white hover:bg-ali-red-dark">
          {saving ? <Loader2 className="size-4 animate-spin" /> : null} Post review
        </Button>
      </div>
    </form>
  );
}

export function ProductReviews({
  slug,
  avg,
  count,
  distribution,
  canReview,
}: {
  slug: string;
  avg: number;
  count: number;
  distribution: Array<{ rating: number; count: number }>;
  canReview: boolean;
}) {
  const queryClient = useQueryClient();
  const [sort, setSort] = useState("helpful");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const query = useQuery({
    queryKey: ["reviews", slug, sort, page],
    queryFn: () => fetchReviews(slug, sort, page),
  });
  const rows = query.data?.data ?? [];
  const pages = query.data?.pages ?? 1;

  const refresh = () => {
    setFormOpen(false);
    queryClient.invalidateQueries({ queryKey: ["reviews", slug] });
    queryClient.invalidateQueries({ queryKey: ["product", slug] });
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-6">
        <div className="text-center">
          <p className="text-4xl font-black">{avg.toFixed(1)}</p>
          <RatingStars rating={avg} />
          <p className="mt-1 text-xs text-neutral-500">{count} ratings</p>
        </div>
        <div className="min-w-52 flex-1 space-y-1">
          {distribution.map((d) => (
            <div key={d.rating} className="flex items-center gap-2 text-xs">
              <span className="w-6 tabular-nums">{d.rating}★</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                <span className="block h-full rounded-full bg-amber-400" style={{ width: `${count ? Math.round((d.count / count) * 100) : 0}%` }} />
              </span>
              <span className="w-8 text-right tabular-nums text-neutral-500">{d.count}</span>
            </div>
          ))}
        </div>
        {canReview && !formOpen ? (
          <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>Write a review</Button>
        ) : null}
      </div>

      {formOpen ? <WriteReview slug={slug} onDone={refresh} /> : null}

      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-500">Sort</span>
        <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="helpful">Most helpful</SelectItem>
            <SelectItem value="recent">Most recent</SelectItem>
            <SelectItem value="highest">Highest</SelectItem>
            <SelectItem value="lowest">Lowest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="px-4 py-1">
        {query.isLoading ? (
          <p className="py-4 text-sm text-neutral-500">Loading reviews…</p>
        ) : query.isError ? (
          <div className="flex items-center gap-2 py-4">
            <p className="text-sm text-red-600" role="alert">
              {query.error instanceof Error ? query.error.message : "Couldn't load reviews."}
            </p>
            <Button size="sm" variant="outline" onClick={() => query.refetch()}>Retry</Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm text-neutral-500">No reviews yet — be the first.</p>
        ) : (
          rows.map((r) => <ReviewCard key={r.id} slug={slug} review={r} />)
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
