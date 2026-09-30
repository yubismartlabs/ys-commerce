"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";

type SellerOrder = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  shipments: Array<{ id: string; storeId: string; status: string; trackingNumber: string | null }>;
  sellerItems: Array<{ qty: number; storeId: string }>;
  sellerSubtotal: number;
};

/** A seller only sees tracking for their own parcel, never a peer's. */
function myTracking(o: SellerOrder): string | null {
  const mine = new Set(o.sellerItems.map((i) => i.storeId));
  const s = o.shipments?.find((x) => mine.has(x.storeId));
  return s?.trackingNumber ?? null;
}

async function fetchOrders(status?: string): Promise<{ data: SellerOrder[] }> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const res = await fetch(`/api/v1/selling/orders?${params.toString()}`);
  if (res.status === 401) throw new Error("Sign in as a seller to view orders.");
  if (!res.ok) throw new Error("Couldn't load orders.");
  return res.json();
}

const statuses = ["PAID", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];

export default function SellingOrdersPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const query = useQuery({
    queryKey: ["selling-orders", status ?? "all"],
    queryFn: () => fetchOrders(status),
    retry: false,
  });
  const rows = query.data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Orders</h1>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant={status === undefined ? "default" : "outline"} className="rounded-full" onClick={() => setStatus(undefined)}>ALL</Button>
          {statuses.map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} className="rounded-full" onClick={() => setStatus(status === s ? undefined : s)}>{s}</Button>
          ))}
        </div>
      </div>
      <Card className="overflow-hidden p-0">
        {query.isLoading ? (
          <p className="p-6 text-sm text-neutral-500">Loading orders…</p>
        ) : query.isError ? (
          <div className="space-y-2 p-6 text-sm text-neutral-500">
            <p>{query.error.message}</p>
            <Button size="sm" variant="outline" asChild><Link href="/selling/onboarding">Open a store</Link></Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">No orders with your items yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Order</TableHead><TableHead>My items</TableHead><TableHead>My subtotal</TableHead><TableHead>Status</TableHead><TableHead>Tracking</TableHead><TableHead>Placed</TableHead><TableHead className="text-right">Action</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono font-medium">{o.number}</TableCell>
                  <TableCell className="tabular-nums">{o.sellerItems.reduce((a, i) => a + i.qty, 0)}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatUSD(o.sellerSubtotal)}</TableCell>
                  <TableCell><StatusBadge value={o.status} /></TableCell>
                  <TableCell className="max-w-32 truncate font-mono text-xs">{myTracking(o) ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-neutral-500">{timeAgo(o.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/selling/orders/${o.id}`}>Open <ChevronRight className="size-3.5" /></Link>
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
