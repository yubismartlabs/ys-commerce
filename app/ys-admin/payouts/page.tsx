"use client";

import { useState } from "react";
import { useTable } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader, Pager, StatusBadge, StatusFilter, TableSkeleton } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";

const statuses = ["PENDING", "PROCESSING", "PAID", "FAILED"] as const;

type Payout = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  store: { name: string; slug: string };
};

export default function PayoutsPage() {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const { tableQuery, filters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<Payout>({
      resource: "payouts",
      pagination: { pageSize: 20, mode: "server" },
      syncWithLocation: true,
    });

  const active = filters.find((f) => "field" in f && f.field === "status") as { value: string } | undefined;
  const rows = tableQuery.data?.data ?? [];
  const total = tableQuery.data?.total;

  const runScheduler = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/v1/admin/ops/run", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Scheduler failed.");
      const { release, payouts } = json.data as { release: { released: number }; payouts: { paid: number; total: number } };
      toast.success(`Released ${release.released} hold(s), paid ${payouts.paid} payout(s) ($${payouts.total.toFixed(2)}).`);
      tableQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-notifications-bell"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scheduler failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payouts"
        description="Released escrow accrues here; the scheduler auto-pays above the minimum."
        actions={
          <Button variant="outline" onClick={runScheduler} disabled={running}>
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Run scheduler
          </Button>
        }
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
          <ErrorState message="Failed to load payouts." />
        ) : rows.length === 0 ? (
          <EmptyState title="No payouts yet" hint="Released escrow creates pending payouts automatically." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Store</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Paid</TableHead><TableHead>Created</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <TableCell className="font-medium">{p.store.name}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatUSD(p.amount)} {p.currency}</TableCell>
                  <TableCell><StatusBadge value={p.status} /></TableCell>
                  <TableCell className="whitespace-nowrap text-neutral-500">{p.paidAt ? timeAgo(p.paidAt) : "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-neutral-500">{timeAgo(p.createdAt)}</TableCell>
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
