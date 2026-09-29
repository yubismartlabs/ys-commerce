"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/lib/refine/types";

type BellResponse = {
  data: NotificationItem[];
  pagination: { page: number; pageSize: number; total: number };
  unreadCount: number;
};

async function fetchBell(): Promise<BellResponse> {
  const res = await fetch("/api/v1/admin/notifications?page=1&pageSize=8");
  if (!res.ok) throw new Error("notifications unavailable");
  return res.json();
}

async function markRead(ids: string[] | "all"): Promise<void> {
  const res = await fetch("/api/v1/admin/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ids === "all" ? { allRead: true } : { ids }),
  });
  if (!res.ok) throw new Error("mark-read failed");
}

export function NotificationBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-notifications-bell"],
    queryFn: fetchBell,
    refetchInterval: 30_000,
    retry: 1,
  });

  const items = query.data?.data ?? [];
  const unread = query.data?.unreadCount ?? 0;

  const read = async (ids: string[] | "all", link?: string | null) => {
    try {
      await markRead(ids);
    } catch {
      // Best effort — still navigate.
    }
    queryClient.invalidateQueries({ queryKey: ["admin-notifications-bell"] });
    queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    if (link) router.push(link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-5" />
          {unread > 0 ? (
            <Badge className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ali-red px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications{unread > 0 ? ` (${unread} unread)` : ""}</span>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => read("all")}
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </Button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {query.isLoading ? (
          <p className="px-3 py-6 text-center text-sm text-neutral-500">Loading…</p>
        ) : query.isError ? (
          <p className="px-3 py-6 text-center text-sm text-neutral-500">Couldn&apos;t load notifications.</p>
        ) : items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-neutral-500">All caught up.</p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={cn("flex cursor-pointer flex-col items-start gap-0.5 px-3 py-2.5", !n.readAt && "bg-neutral-50 dark:bg-neutral-900")}
              onClick={() => read([n.id], n.link)}
            >
              <span className="flex w-full items-center gap-2">
                {!n.readAt ? <span className="size-1.5 shrink-0 rounded-full bg-ali-red" /> : null}
                <span className="flex-1 truncate text-sm font-semibold">{n.title}</span>
                <span className="shrink-0 text-[11px] text-neutral-400">{timeAgo(n.createdAt)}</span>
              </span>
              {n.body ? <span className="line-clamp-2 text-xs text-neutral-500">{n.body}</span> : null}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="justify-center">
          <Link href="/ys-admin/notifications" className="w-full text-center text-sm font-medium">
            View all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
