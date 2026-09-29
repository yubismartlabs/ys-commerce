"use client";

import Link from "next/link";
import { useState } from "react";
import { useTable } from "@refinedev/core";
import { ChevronRight, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, PageHeader, Pager, TableSkeleton } from "@/components/refine/ui";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  type: string;
  subject: string | null;
  messageCount: number;
  lastMessageAt: string;
  blocked: boolean;
  reportedAt: string | null;
  reportReason: string | null;
  buyer: { email: string } | null;
  seller: { email: string } | null;
  order: { number: string } | null;
};

export default function ChatModPage() {
  const [reportedOnly, setReportedOnly] = useState(false);
  const { tableQuery, setFilters, currentPage, setCurrentPage, pageCount } = useTable<Row>({
    resource: "chat",
    pagination: { pageSize: 20, mode: "server" },
    syncWithLocation: true,
  });
  const rows = tableQuery.data?.data ?? [];
  const total = tableQuery.data?.total;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Message reports"
        description="Metadata only — bodies are end-to-end encrypted and unreadable here."
        actions={
          <Button
            size="sm"
            variant={reportedOnly ? "default" : "outline"}
            className="rounded-full"
            onClick={() => {
              const v = !reportedOnly;
              setReportedOnly(v);
              setFilters(v ? [{ field: "reported", operator: "eq", value: "1" }] : []);
            }}
          >
            Reported only
          </Button>
        }
      />
      <Card className="overflow-hidden p-0">
        {tableQuery.isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : tableQuery.isError ? (
          <ErrorState message="Failed to load conversations." />
        ) : rows.length === 0 ? (
          <EmptyState title="No conversations" hint="Reports land here for metadata review." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Parties</TableHead><TableHead>Context</TableHead><TableHead>Msgs</TableHead><TableHead>Flags</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Action</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <p className="max-w-48 truncate text-xs">{r.buyer?.email ?? "—"}</p>
                    <p className="max-w-48 truncate text-xs text-neutral-500">{r.seller?.email ?? "—"}</p>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <Badge variant="outline" className="font-mono text-[10px]">{r.type}</Badge>
                      <span className="font-mono text-xs">{r.order?.number ?? r.subject ?? "—"}</span>
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">{r.messageCount}</TableCell>
                  <TableCell>
                    <span className="flex gap-1">
                      {r.reportedAt ? <Badge variant="outline" className="bg-red-500/10 text-[10px] text-red-700">REPORTED</Badge> : null}
                      {r.blocked ? <Badge variant="outline" className="text-[10px]">BLOCKED</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell className={cn("whitespace-nowrap text-xs text-neutral-500")}>{timeAgo(r.lastMessageAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/ys-admin/chat/${r.id}`}>Inspect <ChevronRight className="size-3.5" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Pager page={currentPage} pageCount={pageCount} total={total} onPage={setCurrentPage} />
      <p className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Lock className="size-3.5" /> Message bodies stay sealed. Act on metadata: warn, suspend, or close accounts via Users.
      </p>
    </div>
  );
}
