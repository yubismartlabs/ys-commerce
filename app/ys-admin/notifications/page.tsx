"use client";

import Link from "next/link";
import { useState } from "react";
import { useTable } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCheck, ChevronRight, Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, PageHeader, Pager, TableSkeleton } from "@/components/refine/ui";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/lib/refine/types";

const types = [
  "order.cancelled",
  "order.refunded",
  "dispute.updated",
  "dispute.opened",
  "vendor.approved",
  "vendor.suspended",
  "vendor.rejected",
  "product.takedown",
  "product.active",
  "seller.request",
  "stock.low",
  "payout.failed",
  "review.new",
] as const;

async function patchNotifications(body: object): Promise<{ read: number }> {
  const res = await fetch("/api/v1/admin/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Update failed.");
  return json.data as { read: number };
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [digestRunning, setDigestRunning] = useState(false);
  const { tableQuery, filters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<NotificationItem>({
      resource: "notifications",
      pagination: { pageSize: 20, mode: "server" },
      syncWithLocation: true,
    });

  const activeType = filters.find((f) => "field" in f && f.field === "type") as
    | { value: string }
    | undefined;
  const rows = tableQuery.data?.data ?? [];
  const total = tableQuery.data?.total;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-notifications-bell"] });
    tableQuery.refetch();
  };

  const markRead = async (ids: string[] | "all") => {
    try {
      const r = await patchNotifications(ids === "all" ? { allRead: true } : { ids });
      toast.success(ids === "all" ? `${r.read} notifications marked read.` : "Marked as read.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed.");
    }
  };

  const runDigest = async () => {
    setDigestRunning(true);
    try {
      const res = await fetch("/api/v1/admin/notifications/digest", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Digest failed.");
      const c = json.data.counts as Record<string, number>;
      const found = Object.values(c).reduce((a, b) => a + b, 0);
      toast.success(found > 0 ? `Digest found ${found} new item(s).` : "Digest clean — nothing new.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Digest failed.");
    } finally {
      setDigestRunning(false);
    }
  };

  const applyFilters = (type?: string, unread?: boolean) => {
    const next: Array<{ field: string; operator: "eq"; value: string }> = [];
    if (type) next.push({ field: "type", operator: "eq", value: type });
    if (unread) next.push({ field: "unread", operator: "eq", value: "1" });
    setFilters(next);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description="Your admin inbox — order, dispute, vendor, product and ops-digest alerts."
        actions={
          <>
            <Button variant="outline" onClick={() => markRead("all")}>
              <CheckCheck className="size-4" /> Mark all read
            </Button>
            <Button variant="outline" onClick={runDigest} disabled={digestRunning}>
              {digestRunning ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />}
              Run digest scan
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={!unreadOnly ? "default" : "outline"}
          className="rounded-full"
          onClick={() => { setUnreadOnly(false); applyFilters(activeType?.value, false); }}
        >
          ALL
        </Button>
        <Button
          size="sm"
          variant={unreadOnly ? "default" : "outline"}
          className="rounded-full"
          onClick={() => { setUnreadOnly(true); applyFilters(activeType?.value, true); }}
        >
          UNREAD
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {types.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={activeType?.value === t ? "default" : "outline"}
            className="rounded-full font-mono text-xs"
            onClick={() => applyFilters(activeType?.value === t ? undefined : t, unreadOnly)}
          >
            {t}
          </Button>
        ))}
      </div>
      <Card className="overflow-hidden p-0">
        {tableQuery.isLoading ? (
          <TableSkeleton rows={8} cols={3} />
        ) : tableQuery.isError ? (
          <ErrorState message="Failed to load notifications." />
        ) : rows.length === 0 ? (
          <EmptyState title="No notifications" hint="All caught up — try a different filter." />
        ) : (
          <ul className="divide-y">
            {rows.map((n) => (
              <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3", !n.readAt && "bg-neutral-50 dark:bg-neutral-900")}>
                {!n.readAt ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ali-red" /> : <span className="mt-1.5 size-2 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{n.title}</p>
                  {n.body ? <p className="line-clamp-2 text-sm text-neutral-500">{n.body}</p> : null}
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                    <Badge variant="outline" className="font-mono text-[10px]">{n.type}</Badge>
                    <span>{timeAgo(n.createdAt)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {n.link ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={n.link} onClick={() => { if (!n.readAt) markRead([n.id]); }}>
                        Open <ChevronRight className="size-3.5" />
                      </Link>
                    </Button>
                  ) : null}
                  {!n.readAt ? (
                    <Button size="sm" variant="ghost" onClick={() => markRead([n.id])}>
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Pager page={currentPage} pageCount={pageCount} total={total} onPage={setCurrentPage} />
    </div>
  );
}
