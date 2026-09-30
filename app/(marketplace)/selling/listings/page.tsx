"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, Pager } from "@/components/refine/ui";
import { BulkActionBar, SelectAllCheckbox } from "@/components/products/bulk-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { readEnvelope } from "@/lib/api/client";
import { formatUSD } from "@/lib/format";

type Listing = {
  id: string;
  title: string;
  price: number;
  status: string;
  soldCount: number;
  ratingAvg: number;
  ratingCount: number;
  store: { name: string; id?: string };
  variants: Array<{ stock: number }>;
  trackStock: boolean;
  stock: number;
  _count: { reviews: number };
};

type ListResponse = {
  data: Listing[];
  total: number;
  stores: Array<{ id: string; name: string }>;};

type Row = Listing;

const PAGE_SIZE = 20;

export default function ListingsPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["selling-products", status ?? "all", appliedQ, page],
    queryFn: async (): Promise<ListResponse> => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (status) params.set("status", status);
      if (appliedQ) params.set("q", appliedQ);
      const res = await fetch(`/api/v1/selling/products?${params.toString()}`);
      if (res.status === 401) throw new Error("Sign in as a seller.");
      const envelope = await readEnvelope<Row[]>(res);
      return {
        data: envelope.data ?? [],
        total: envelope.pagination?.total ?? 0,
        stores: (envelope.meta?.stores as Array<{ id: string; name: string }>) ?? [],
      };
    },
    retry: false,
  });
  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;

  const rowIds = rows.map((r) => r.id);
  const allSelected = rowIds.length > 0 && rowIds.every((id) => selected.includes(id));
  const someSelected = rowIds.some((id) => selected.includes(id)) && !allSelected;
  const toggleAll = () => setSelected(allSelected ? [] : rowIds);
  const toggleOne = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // Bulk actions are per-store: a selection spanning two stores has no single
  // target, so the bar stays disabled until the seller narrows it.
  const selectedStores = [
    ...new Set(rows.filter((r) => selected.includes(r.id)).map((r) => r.store?.id).filter(Boolean)),
  ];
  const scopeStoreId = selectedStores.length === 1 ? selectedStores[0] : undefined;
  const mixedStores = selected.length > 0 && selectedStores.length > 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Listings</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          {(["DRAFT", "ACTIVE", "TAKEDOWN"] as const).map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} aria-pressed={status === s} className="rounded-full" onClick={() => { setStatus(status === s ? undefined : s); setPage(1); setSelected([]); }}>
              {s}
            </Button>
          ))}
          <Button size="sm" variant="outline" asChild>
            <Link href="/selling/listings/bulk"><Upload className="size-4" /> Bulk import</Link>
          </Button>
          <Button size="sm" asChild className="bg-ali-red text-white hover:bg-ali-red-dark">
            <Link href="/selling/products/new"><Plus className="size-4" /> Add product</Link>
          </Button>
        </div>
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setAppliedQ(q); setPage(1); setSelected([]); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search my listings…" aria-label="Search my listings" className="max-w-64" />
        <Button type="submit" size="sm" variant="outline">Search</Button>
      </form>
      <Card className="overflow-hidden p-0">
        {query.isLoading ? (
          <p className="p-6 text-sm text-neutral-500">Loading listings…</p>
        ) : query.isError ? (
          <div className="space-y-2 p-6 text-sm text-neutral-500">
            <p>{query.error.message}</p>
            <Button size="sm" variant="outline" asChild><Link href="/selling/onboarding">Open a store</Link></Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">No listings yet — add your first product.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox checked={allSelected} indeterminate={someSelected} onToggle={toggleAll} />
                </TableHead>
                <TableHead>Product</TableHead><TableHead>Price</TableHead><TableHead>Stock</TableHead><TableHead>Sold</TableHead><TableHead>Rating</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id} data-state={selected.includes(p.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(p.id)}
                      aria-label={`Select ${p.title}`}
                      onCheckedChange={() => toggleOne(p.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <p className="line-clamp-1 max-w-64 font-medium">{p.title}</p>
                    <p className="text-xs text-neutral-500">{p.store.name}</p>
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatUSD(p.price)}</TableCell>
                  <TableCell className="tabular-nums">
                    {p.variants.length > 0
                      ? p.variants.reduce((a, v) => a + v.stock, 0)
                      : p.trackStock
                        ? p.stock
                        : <span className="text-neutral-400">Not tracked</span>}
                  </TableCell>
                  <TableCell className="tabular-nums">{p.soldCount}</TableCell>
                  <TableCell className="tabular-nums">★ {p.ratingAvg.toFixed(1)} ({p.ratingCount})</TableCell>
                  <TableCell><StatusBadge value={p.status} /></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/selling/products/${p.id}`}>Edit <ChevronRight className="size-3.5" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      {pages > 1 ? (
        <Pager page={page} pageCount={pages} total={total} onPage={(n) => { setPage(n); setSelected([]); }} />
      ) : null}
      {mixedStores ? (
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          Your selection spans {selectedStores.length} stores. Bulk actions apply to one store at a time —
          filter to a single store first.
        </p>
      ) : null}
      <BulkActionBar storeId={scopeStoreId} selected={selected} onClear={() => setSelected([])} />
    </div>
  );
}
