"use client";

import Link from "next/link";
import { useTable, useUpdate } from "@refinedev/core";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader, Pager, StatusBadge, StatusFilter, TableSkeleton } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";
import type { Order } from "@/lib/refine/types";

const statuses = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;

export default function OrdersPage() {
  const { tableQuery, filters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<Order>({
      resource: "orders",
      pagination: { pageSize: 20, mode: "server" },
      syncWithLocation: true,
    });

  const { mutate, mutation } = useUpdate();
  const active = filters.find((f) => "field" in f && f.field === "status") as { value: string } | undefined;
  const rows = tableQuery.data?.data ?? [];
  const total = tableQuery.data?.total;
  const busy = mutation.isPending;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orders"
        description="Track every order across vendors — cancel mistakes, refund buyers."
      />
      <StatusFilter
        options={statuses}
        value={active?.value}
        onChange={(v) => setFilters(v ? [{ field: "status", operator: "eq", value: v }] : [])}
      />
      <Card className="overflow-hidden p-0">
        {tableQuery.isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : tableQuery.isError ? (
          <ErrorState message="Failed to load orders. Check the API connection and retry." />
        ) : rows.length === 0 ? (
          <EmptyState title="No orders found" hint="Try a different status filter." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Order</TableHead><TableHead>Items</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Placed</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow key={o.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <TableCell className="font-mono font-medium">
                    <Link href={`/ys-admin/orders/show/${o.id}`} className="underline-offset-2 hover:underline">
                      {o.number}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">{o.items.reduce((a, i) => a + i.qty, 0)}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatUSD(o.total)}</TableCell>
                  <TableCell><StatusBadge value={o.status} /></TableCell>
                  <TableCell className="whitespace-nowrap text-neutral-500">{timeAgo(o.createdAt)}</TableCell>
                  <TableCell className="space-x-2 whitespace-nowrap text-right">
                    {o.status !== "REFUNDED" && o.status !== "CANCELLED" && (
                      <>
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => mutate({ resource: "orders", id: o.id, values: { status: "REFUNDED" } })}>Refund</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => mutate({ resource: "orders", id: o.id, values: { status: "CANCELLED" } })}>Cancel</Button>
                      </>
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
