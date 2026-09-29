"use client";

import { useState } from "react";
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

function SearchBody() {
  const router = useRouter();
  const params = useSearchParams();
  const [page, setPage] = useState(1);

  const [minPrice, setMinPrice] = useState(params.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(params.get("maxPrice") ?? "");
  const [free, setFree] = useState(params.get("freeShipping") === "1");
  const [rated, setRated] = useState(params.get("minRating") === "4");
  const [deals, setDeals] = useState(params.get("deals") === "1");
  const [sort, setSort] = useState(params.get("sort") ?? (params.get("q") ? "relevance" : "newest"));
  const [category, setCategory] = useState(params.get("category") ?? "");

  const key = params.toString();
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

  const apply = () => {
    const q = new URLSearchParams();
    const initial = params.get("q");
    if (initial) q.set("q", initial);
    if (category) q.set("category", category);
    if (minPrice) q.set("minPrice", minPrice);
    if (maxPrice) q.set("maxPrice", maxPrice);
    if (free) q.set("freeShipping", "1");
    if (rated) q.set("minRating", "4");
    if (deals) q.set("deals", "1");
    const defaultSort = params.get("q") ? "relevance" : "newest";
    if (sort !== defaultSort) q.set("sort", sort);
    setPage(1);
    router.push(`/search?${q.toString()}`);
  };

  const title = params.get("q") ? `Results for "${params.get("q")}"` : category || "All products";

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="lg:block">
        <Card className="space-y-4 p-4 text-sm">
          <div>
            <p className="mb-2 font-bold">Price (USD)</p>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Min" inputMode="decimal" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              <Input placeholder="Max" inputMode="decimal" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
            </div>
          </div>
          <div>
            <p className="mb-2 font-bold">Category</p>
            <Select value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
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
              <Checkbox checked={free} onCheckedChange={(v) => setFree(v === true)} /> Free shipping
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <Checkbox checked={rated} onCheckedChange={(v) => setRated(v === true)} /> 4★ & up
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <Checkbox checked={deals} onCheckedChange={(v) => setDeals(v === true)} /> Flash deals
            </label>
          </div>
          <div>
            <p className="mb-2 font-bold">Sort by</p>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {params.get("q") ? <SelectItem value="relevance">Most relevant</SelectItem> : null}
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="sold">Best selling</SelectItem>
                <SelectItem value="rating">Top rated</SelectItem>
                <SelectItem value="price_asc">Price: low to high</SelectItem>
                <SelectItem value="price_desc">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={apply}>Apply filters</Button>
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
            <p>No results for &ldquo;{params.get("q")}&rdquo;.</p>
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
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
                <span className="tabular-nums">Page {page} of {pages}</span>
                <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
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
