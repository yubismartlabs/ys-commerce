"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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

type Item = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

async function fetchBell(): Promise<{ data: Item[]; unreadCount: number }> {
  const res = await fetch("/api/v1/account/notifications?page=1&pageSize=8");
  if (!res.ok) throw new Error("unavailable");
  return res.json();
}

/** Buyer inbox bell for the marketplace header (authenticated only). */
export function BuyerBell() {
  const { status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["buyer-notifications-bell"],
    queryFn: fetchBell,
    enabled: status === "authenticated",
    refetchInterval: 60_000,
    retry: 1,
  });

  if (status !== "authenticated") return null;
  const items = query.data?.data ?? [];
  const unread = query.data?.unreadCount ?? 0;

  const read = async (ids: string[] | "all", link?: string | null) => {
    try {
      await fetch("/api/v1/account/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids === "all" ? { allRead: true } : { ids }),
      });
    } catch {
      // Best effort — still navigate.
    }
    queryClient.invalidateQueries({ queryKey: ["buyer-notifications-bell"] });
    queryClient.invalidateQueries({ queryKey: ["buyer-notifications"] });
    if (link) router.push(link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell />
          {unread > 0 ? (
            <Badge className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ali-red p-0 px-0.5 text-[10px] text-white">
              {unread > 99 ? "99+" : unread}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications{unread > 0 ? ` (${unread} unread)` : ""}</span>
          {unread > 0 ? (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => read("all")}>
              <CheckCheck className="size-3.5" /> Mark all read
            </Button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {query.isLoading ? (
          <p className="px-3 py-6 text-center text-sm text-neutral-500">Loading…</p>
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
          <Link href="/account/notifications" className="w-full text-center text-sm font-medium">
            View all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
