"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useTable, useCreate, useDelete } from "@refinedev/core";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, PageHeader, Pager, StatusBadge, TableSkeleton } from "@/components/refine/ui";
import { timeAgo } from "@/lib/format";
import type { Coupon } from "@/lib/refine/types";

export default function CouponsPage() {
  const { tableQuery, currentPage, setCurrentPage, pageCount } =
    useTable<Coupon>({
      resource: "coupons",
      pagination: { pageSize: 20, mode: "server" },
      syncWithLocation: true,
    });

  const { mutate: create, mutation: creating } = useCreate();
  const { mutate: remove, mutation: deleting } = useDelete();
  const [code, setCode] = useState("");
  const [pct, setPct] = useState("10");
  const rows = tableQuery.data?.data ?? [];
  const total = tableQuery.data?.total;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Coupons"
        description="Sitewide discount codes applied at checkout."
        actions={
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              create(
                { resource: "coupons", values: { code, pctOff: Number(pct) } },
                { onSuccess: () => { setCode(""); setPct("10"); } }
              );
            }}
          >
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CODE" className="w-36 uppercase" required />
            <Input value={pct} onChange={(e) => setPct(e.target.value)} placeholder="%" inputMode="numeric" className="w-20" required />
            <Button type="submit" disabled={creating.isPending} className="bg-ali-red text-white hover:bg-ali-red-dark">
              <Plus className="size-4" /> Create
            </Button>
          </form>
        }
      />
      <Card className="overflow-hidden p-0">
        {tableQuery.isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : tableQuery.isError ? (
          <ErrorState message="Failed to load coupons. Check the API connection and retry." />
        ) : rows.length === 0 ? (
          <EmptyState title="No coupons yet" hint="Create your first discount code with the form above." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Code</TableHead><TableHead>Off</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <TableCell>
                    <Link href={`/ys-admin/coupons/show/${c.id}`} className="rounded-md bg-neutral-100 px-2 py-1 font-mono text-[13px] font-bold underline-offset-2 hover:underline dark:bg-neutral-800">
                      {c.code}
                    </Link>
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums">−{c.pctOff}%</TableCell>
                  <TableCell><StatusBadge value={c.active ? "ACTIVE" : "INACTIVE"} /></TableCell>
                  <TableCell className="whitespace-nowrap text-neutral-500">{timeAgo(c.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deleting.isPending}
                      onClick={() => { if (window.confirm("Delete this coupon?")) remove({ resource: "coupons", id: c.id }); }}
                    >
                      Delete
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
