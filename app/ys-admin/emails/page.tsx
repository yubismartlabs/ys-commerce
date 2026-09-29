"use client";

import { useTable } from "@refinedev/core";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, PageHeader, Pager, StatusFilter, TableSkeleton } from "@/components/refine/ui";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EmailLogItem } from "@/lib/refine/types";

const statuses = ["SENT", "SKIPPED", "FAILED"] as const;

function statusClass(s: string): string {
  if (s === "SENT") return "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-400";
  if (s === "FAILED") return "bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-400";
  return "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-400";
}

export default function EmailsPage() {
  const { tableQuery, filters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<EmailLogItem>({
      resource: "emails",
      pagination: { pageSize: 20, mode: "server" },
      syncWithLocation: true,
    });

  const active = filters.find((f) => "field" in f && f.field === "status") as
    | { value: string }
    | undefined;
  const rows = tableQuery.data?.data ?? [];
  const total = tableQuery.data?.total;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Email log"
        description="Every outbound email — recipient, template, delivery status and errors."
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
          <ErrorState message="Failed to load the email log." />
        ) : rows.length === 0 ? (
          <EmptyState title="No emails logged" hint="Sends from orders, disputes, vendors and digests land here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>To</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <TableCell className="max-w-56 truncate font-medium">{e.to || "—"}</TableCell>
                  <TableCell className="max-w-72 truncate text-neutral-500">{e.subject}</TableCell>
                  <TableCell><Badge variant="outline" className="font-mono text-[10px]">{e.template}</Badge></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("gap-1.5 rounded-full font-semibold ring-1 ring-inset", statusClass(e.status))}>
                      {e.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-neutral-500">
                    {e.status === "FAILED" ? (e.error ?? "failed") : (e.resendId ?? "—")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-neutral-500">{timeAgo(e.createdAt)}</TableCell>
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
