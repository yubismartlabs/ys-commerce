"use client";

import { useState } from "react";
import { useTable } from "@refinedev/core";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, PageHeader, Pager, TableSkeleton } from "@/components/refine/ui";
import { timeAgo } from "@/lib/format";

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  actor: { email: string; name: string | null } | null;
};

export default function AuditPage() {
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const { tableQuery, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<AuditRow>({
      resource: "audit",
      pagination: { pageSize: 20, mode: "server" },
      syncWithLocation: true,
    });

  const rows = tableQuery.data?.data ?? [];
  const total = tableQuery.data?.total;

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Array<{ field: string; operator: "eq"; value: string }> = [];
    if (action.trim()) next.push({ field: "action", operator: "eq", value: action.trim() });
    if (entity.trim()) next.push({ field: "entity", operator: "eq", value: entity.trim() });
    setFilters(next);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Activity log"
        description="Every admin and system action — who did what, and when."
      />
      <form className="flex flex-wrap gap-2" onSubmit={apply}>
        <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Filter action, e.g. order.refunded" className="max-w-64 font-mono text-xs" />
        <Input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="Filter entity, e.g. Order" className="max-w-48" />
        <Button type="submit" size="sm" variant="outline">Filter</Button>
      </form>
      <Card className="overflow-hidden p-0">
        {tableQuery.isLoading ? (
          <TableSkeleton rows={8} cols={4} />
        ) : tableQuery.isError ? (
          <ErrorState message="Failed to load the activity log." />
        ) : rows.length === 0 ? (
          <EmptyState title="No activity found" hint="Try different filters." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Actor</TableHead><TableHead>When</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <TableCell><Badge variant="outline" className="font-mono text-[10px]">{a.action}</Badge></TableCell>
                  <TableCell className="text-sm">{a.entity} <span className="font-mono text-xs text-neutral-400">{a.entityId.slice(0, 8)}</span></TableCell>
                  <TableCell className="max-w-48 truncate text-sm text-neutral-500">
                    {a.actor ? (a.actor.name ?? a.actor.email) : "system"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-neutral-500">{timeAgo(a.createdAt)}</TableCell>
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
