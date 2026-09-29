"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiProductCard, type ApiCardRow } from "@/components/commerce/api-product-card";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Row = ApiCardRow;

const PAGE_SIZE = 24;

/** Draft price fields, applied on submit. Remounted (via key) when the URL
 * changes so the inputs always reflect the active query. */
function PriceFilter({ minPrice, maxPrice, onApply }: { minPrice: string; maxPrice: string; onApply: (min: string, max: string) => void }) {
  const [min, setMin] = useState(minPrice);
  const [max, setMax] = useState(maxPrice);

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(min.trim(), max.trim());
      }}
    >
      <div>
        <p className="mb-2 font-bold">Price (USD)</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label htmlFor="f-min" className="text-[11px] font-semibold text-neutral-500">Min</label>
            <Input id="f-min" placeholder="0" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="f-max" className="text-[11px] font-semibold text-neutral-500">Max</label>
            <Input id="f-max" placeholder="100" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} />
          </div>
        </div>
      </div>
      <Button type="submit" variant="outline" size="sm" className="w-full">Apply price</Button>
    </form>
  );
}

function SearchBody() {
  const router = useRouter();
  const params = useSearchParams();

  // URL is the single source of truth for filters + page, so back/forward and
  // header links always render the active state.
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const minPrice = params.get("minPrice") ?? "";
  const maxPrice = params.get("maxPrice") ?? "";
  const free = params.get("freeShipping") === "1";
  const rated = params.get("minRating") === "4";
  const deals = params.get("deals") === "1";
  const defaultSort = q ? "relevance" : "newest";
  const sort = params.get("sort") ?? defaultSort;
  const page = Math.max(1, Number(params.get("page")) || 1);

  const key = useMemo(() => {
    const sp = new URLSearchParams(params.toString());
    sp.delete("page");
    return sp.toString();
  }, [params]);

  const query = useQuery({
    queryKey: ["search", key, page],
    queryFn: async (): Promise<{
      data: Row[];
      total: number;
      pages: number;
      categories: Array<{ category: string; count: number }>;
      suggestion: string[];
    }> => {
      const res = await fetch(`/api/v1/products?${key}&page=${page}&pageSize=${PAGE_SIZE}`);
      if (!res.ok) throw new Error("Search failed.");
      const json = await res.json();
      return {
        data: json.data,
        total: json.pagination.total,
        pages: Math.max(1, Math.ceil(json.pagination.total / PAGE_SIZE)),
        categories: json.meta?.categories ?? [],
        suggestion: json.meta?.suggestion ?? [],
      };
    },
    retry: 1,
  });
  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const pages = query.data?.pages ?? 1;
  const categories = query.data?.categories ?? [];
  const suggestion = query.data?.suggestion ?? [];
  const loading = query.isLoading;
  const error = query.isError ? "Search failed. Retry." : null;

  /** Navigate with a patch applied to the current filters; filters reset to page 1. */
  const push = (patch: Record<string, string | null>, targetPage = 1) => {
    const sp = new URLSearchParams(key);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    sp.delete("page");
    if (targetPage > 1) sp.set("page", String(targetPage));
    const qs = sp.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  };

  // Selects + toggles apply instantly; price fields use Apply (avoids a
  // navigation per keystroke).
  const title = q ? `Results for "${q}"` : category || "All products";

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="lg:block">
        <Card className="space-y-4 p-4 text-sm">
          <PriceFilter
            key={`${minPrice}|${maxPrice}`}
            minPrice={minPrice}
            maxPrice={maxPrice}
            onApply={(min, max) => push({ minPrice: min, maxPrice: max })}
          />
          <div>
            <p className="mb-2 font-bold">Category</p>
            <Select value={category || "all"} onValueChange={(v) => push({ category: v === "all" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({categories.reduce((a, c) => a + c.count, 0)})</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.category} value={c.category}>{c.category} ({c.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <Checkbox checked={free} onCheckedChange={(v) => push({ freeShipping: v === true ? "1" : null })} /> Free shipping
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <Checkbox checked={rated} onCheckedChange={(v) => push({ minRating: v === true ? "4" : null })} /> 4★ & up
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <Checkbox checked={deals} onCheckedChange={(v) => push({ deals: v === true ? "1" : null })} /> Flash deals
            </label>
          </div>
          <div>
            <p className="mb-2 font-bold">Sort by</p>
            <Select value={sort} onValueChange={(v) => push({ sort: v === defaultSort ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {q ? <SelectItem value="relevance">Most relevant</SelectItem> : null}
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="sold">Best selling</SelectItem>
                <SelectItem value="rating">Top rated</SelectItem>
                <SelectItem value="price_asc">Price: low to high</SelectItem>
                <SelectItem value="price_desc">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>
      </aside>
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold">{title}</h1>
          <Badge variant="secondary">{loading ? "…" : `${total} items`}</Badge>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
            ))}
          </div>
        ) : error ? (
          <Card className="p-10 text-center text-sm text-neutral-500">{error}</Card>
        ) : rows.length === 0 ? (
          <Card className="space-y-2 p-10 text-center text-sm text-neutral-500">
            <p>No results{q ? ` for “${q}”` : ""}.</p>
            {suggestion.length > 0 ? (
              <p>
                Did you mean{" "}
                {suggestion.map((s, i) => (
                  <span key={s}>
                    {i > 0 ? " or " : ""}
                    <Link href={`/search?q=${encodeURIComponent(s)}`} className="font-semibold text-ali-red hover:underline">
                      {s}
                    </Link>
                  </span>
                ))}
                ?
              </p>
            ) : (
              <p>Try another keyword.</p>
            )}
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {rows.map((p) => (
                <ApiProductCard key={p.slug} product={p} />
              ))}
            </div>
            {pages > 1 ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => push({}, page - 1)}>Prev</Button>
                <span className="tabular-nums">Page {page} of {pages}</span>
                <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => push({}, page + 1)}>Next</Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchBody />
    </Suspense>
  );
}
