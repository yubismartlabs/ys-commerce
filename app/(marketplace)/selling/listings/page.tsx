"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/refine/ui";
import { formatUSD } from "@/lib/format";

type Listing = {
  id: string;
  title: string;
  price: number;
  status: string;
  soldCount: number;
  ratingAvg: number;
  ratingCount: number;
  store: { name: string };
  variants: Array<{ stock: number }>;
  _count: { reviews: number };
};

type ListResponse = {
  data: Listing[];
  total: number;
  stores: Array<{ id: string; name: string }>;
};

export default function ListingsPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const query = useQuery({
    queryKey: ["selling-products", status ?? "all", appliedQ],
    queryFn: async (): Promise<ListResponse> => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (appliedQ) params.set("q", appliedQ);
      const res = await fetch(`/api/v1/selling/products?${params.toString()}`);
      if (res.status === 401) throw new Error("Sign in as a seller.");
      if (!res.ok) throw new Error("Couldn't load listings.");
      const json = await res.json();
      return { data: json.data, total: json.pagination.total, stores: json.meta?.stores ?? [] };
    },
    retry: false,
  });
  const rows = query.data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Listings</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          {(["DRAFT", "ACTIVE", "TAKEDOWN"] as const).map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} className="rounded-full" onClick={() => setStatus(status === s ? undefined : s)}>
              {s}
            </Button>
          ))}
          <Button size="sm" asChild className="bg-ali-red text-white hover:bg-ali-red-dark">
            <Link href="/selling/products/new"><Plus className="size-4" /> Add product</Link>
          </Button>
        </div>
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setAppliedQ(q); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search my listings…" className="max-w-64" />
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
              <TableRow><TableHead>Product</TableHead><TableHead>Price</TableHead><TableHead>Stock</TableHead><TableHead>Sold</TableHead><TableHead>Rating</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="line-clamp-1 max-w-64 font-medium">{p.title}</p>
                    <p className="text-xs text-neutral-500">{p.store.name}</p>
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatUSD(p.price)}</TableCell>
                  <TableCell className="tabular-nums">{p.variants.reduce((a, v) => a + v.stock, 0)}</TableCell>
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
    </div>
  );
}
