"use client";

import Link from "next/link";
import { useTable } from "@refinedev/core";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader, Pager, StatusBadge, StatusFilter, TableSkeleton } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";
import type { Dispute } from "@/lib/refine/types";

const statuses = ["OPEN", "UNDER_REVIEW", "RESOLVED_BUYER", "RESOLVED_SELLER", "CLOSED"] as const;

export default function DisputesPage() {
  const { tableQuery, filters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<Dispute>({
      resource: "disputes",
      pagination: { pageSize: 20, mode: "server" },
      syncWithLocation: true,
    });

  const active = filters.find((f) => "field" in f && f.field === "status") as { value: string } | undefined;
  const rows = tableQuery.data?.data ?? [];
  const total = tableQuery.data?.total;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Disputes"
        description="Mediate buyer–seller conflicts — review threads and rule on outcomes."
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
          <ErrorState message="Failed to load disputes. Check the API connection and retry." />
        ) : rows.length === 0 ? (
          <EmptyState title="No disputes found" hint="A quiet queue — try a different status filter." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Order</TableHead><TableHead>Buyer</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Opened</TableHead><TableHead className="text-right">Action</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <TableCell className="font-mono font-medium">{d.order.number}</TableCell>
                  <TableCell className="text-neutral-500">{d.buyer.email}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatUSD(d.order.total)}</TableCell>
                  <TableCell><StatusBadge value={d.status} /></TableCell>
                  <TableCell className="whitespace-nowrap text-neutral-500">{timeAgo(d.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/ys-admin/disputes/show/${d.id}`}>
                        Open <ChevronRight className="size-3.5" />
                      </Link>
                    </Button>
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
