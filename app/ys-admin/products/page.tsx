"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { useTable, useUpdate } from "@refinedev/core";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, PageHeader, Pager, StatusBadge, TableSkeleton } from "@/components/refine/ui";
import { formatUSD } from "@/lib/format";
import type { Product } from "@/lib/refine/types";

export default function ProductsPage() {
  const [q, setQ] = useState("");
  const { tableQuery, filters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<Product>({
      resource: "products",
      pagination: { pageSize: 20, mode: "server" },
      syncWithLocation: true,
    });

  const { mutate, mutation } = useUpdate();
  const rows = tableQuery.data?.data ?? [];
  const total = tableQuery.data?.total;
  const busy = mutation.isPending;

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const next = filters.filter((f) => !("field" in f && f.field === "q"));
    setFilters(q ? [...next, { field: "q", operator: "contains", value: q }] : next);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        description="Moderate the catalog — take down violating listings or restore them after review."
      />
      <form onSubmit={search} className="flex max-w-sm gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title…" className="pl-8" />
        </div>
        <Button type="submit" variant="outline">Search</Button>
      </form>
      <Card className="overflow-hidden p-0">
        {tableQuery.isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : tableQuery.isError ? (
          <ErrorState message="Failed to load products. Check the API connection and retry." />
        ) : rows.length === 0 ? (
          <EmptyState title="No products found" hint="Try a different search term." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Product</TableHead><TableHead>Store</TableHead><TableHead>Price</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <TableCell className="max-w-80">
                    <Link href={`/ys-admin/products/show/${p.id}`} className="flex items-center gap-2.5">
                      <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                        <Image src={p.image} alt="" fill sizes="40px" className="object-cover" />
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-2 block font-medium underline-offset-2 hover:underline">{p.title}</span>
                        {(p._count?.reports ?? 0) > 0 ? (
                          <span className="mt-1 inline-flex w-fit items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-600">
                            {p._count!.reports} report{p._count!.reports === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-neutral-500">{p.store.name}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatUSD(p.price)}</TableCell>
                  <TableCell><StatusBadge value={p.status} /></TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {p.status === "ACTIVE" ? (
                      <Button size="sm" variant="destructive" disabled={busy} onClick={() => mutate({ resource: "products", id: p.id, values: { status: "TAKEDOWN" } })}>Takedown</Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => mutate({ resource: "products", id: p.id, values: { status: "ACTIVE" } })}>Restore</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Pager page={currentPage} pageCount={pageCount} total={total} onPage={setCurrentPage} />
    </div>
  );
}
