"use client";

import Link from "next/link";
import { useTable, useUpdate } from "@refinedev/core";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState, ErrorState, PageHeader, Pager, StatusBadge, StatusFilter, TableSkeleton } from "@/components/refine/ui";
import { initials, timeAgo } from "@/lib/format";
import type { Vendor } from "@/lib/refine/types";

const statuses = ["PENDING", "APPROVED", "SUSPENDED", "REJECTED"] as const;

export default function VendorsPage() {
  const { tableQuery, filters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<Vendor>({
      resource: "vendors",
      pagination: { pageSize: 20, mode: "server" },
      filters: { initial: [{ field: "status", operator: "eq", value: "PENDING" }] },
      syncWithLocation: true,
    });

  const { mutate, mutation } = useUpdate();
  const active = filters.find((f) => "field" in f && f.field === "status") as { value: string } | undefined;
  const rows = tableQuery.data?.data ?? [];
  const total = tableQuery.data?.total;
  const busy = mutation.isPending;

  const act = (id: string, status: Vendor["status"]) =>
    mutate({ resource: "vendors", id, values: { status } });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vendors"
        description="Approve new sellers, suspend bad actors, and review store applications."
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
          <ErrorState message="Failed to load vendors. Check the API connection and retry." />
        ) : rows.length === 0 ? (
          <EmptyState title="No vendors found" hint="Try a different status filter — new applications land in PENDING." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Vendor</TableHead><TableHead>Owner</TableHead><TableHead>Products</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v) => (
                <TableRow key={v.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <TableCell>
                    <Link href={`/ys-admin/vendors/show/${v.id}`} className="flex items-center gap-2.5">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-neutral-900 text-[11px] font-bold text-white dark:bg-white dark:text-neutral-900">
                          {initials(v.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium underline-offset-2 hover:underline">{v.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-neutral-500">{v.owner.email}</TableCell>
                  <TableCell className="tabular-nums">{v._count.products}</TableCell>
                  <TableCell><StatusBadge value={v.status} /></TableCell>
                  <TableCell className="whitespace-nowrap text-neutral-500">{timeAgo(v.createdAt)}</TableCell>
                  <TableCell className="space-x-2 whitespace-nowrap text-right">
                    {v.status === "PENDING" && (
                      <>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => act(v.id, "APPROVED")}>Approve</Button>
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => act(v.id, "REJECTED")}>Reject</Button>
                      </>
                    )}
                    {v.status === "APPROVED" && (
                      <Button size="sm" variant="destructive" disabled={busy} onClick={() => act(v.id, "SUSPENDED")}>Suspend</Button>
                    )}
                    {v.status === "SUSPENDED" && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => act(v.id, "APPROVED")}>Reinstate</Button>
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
