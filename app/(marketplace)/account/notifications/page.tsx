"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

async function patchNotif(body: object): Promise<number> {
  const res = await fetch("/api/v1/account/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Update failed.");
  return (await res.json()).data.read as number;
}

export default function BuyerNotificationsPage() {
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["buyer-notifications", unreadOnly, page],
    queryFn: async (): Promise<{ data: Item[]; total: number; unread: number }> => {
      const res = await fetch(`/api/v1/account/notifications?page=${page}&pageSize=20${unreadOnly ? "&unread=1" : ""}`);
      if (res.status === 401) throw new Error("Sign in to see notifications.");
      if (!res.ok) throw new Error("Couldn't load notifications.");
      const json = await res.json();
      return { data: json.data, total: json.pagination.total, unread: json.unreadCount };
    },
    retry: false,
  });
  const prefsQuery = useQuery({
    queryKey: ["buyer-prefs"],
    queryFn: async (): Promise<{ lifecycle: boolean; priceAlerts: boolean }> => {
      const res = await fetch("/api/v1/account/preferences");
      if (!res.ok) throw new Error("prefs");
      return (await res.json()).data;
    },
    retry: false,
  });

  const rows = query.data?.data ?? [];
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["buyer-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["buyer-notifications-bell"] });
  };

  const mark = async (body: object, msg: string) => {
    try {
      const n = await patchNotif(body);
      toast.success(msg.replace("{n}", String(n)));
      refresh();
    } catch {
      toast.error("Update failed.");
    }
  };

  const setPref = async (key: "lifecycle" | "priceAlerts", value: boolean) => {
    try {
      const res = await fetch("/api/v1/account/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error("Save failed.");
      queryClient.invalidateQueries({ queryKey: ["buyer-prefs"] });
      toast.success("Email preferences updated.");
    } catch {
      toast.error("Save failed.");
    }
  };

  const prefs = prefsQuery.data;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Notifications</h1>
        <div className="flex gap-1.5">
          <Button size="sm" variant={!unreadOnly ? "default" : "outline"} className="rounded-full" onClick={() => { setUnreadOnly(false); setPage(1); }}>All</Button>
          <Button size="sm" variant={unreadOnly ? "default" : "outline"} className="rounded-full" onClick={() => { setUnreadOnly(true); setPage(1); }}>Unread</Button>
          <Button size="sm" variant="outline" className="gap-1 rounded-full" onClick={() => mark({ allRead: true }, "Marked {n} as read.")}>
            <CheckCheck className="size-3.5" /> Mark all read
          </Button>
        </div>
      </div>

      <Card className="px-4 py-1">
        {query.isLoading ? (
          <p className="py-4 text-sm text-neutral-500">Loading…</p>
        ) : query.isError ? (
          <p className="py-4 text-sm text-neutral-500">{query.error.message}</p>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm text-neutral-500">All caught up.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((n) => (
              <li key={n.id} className={cn("flex items-start gap-3 py-3", !n.readAt && "font-medium")}>
                {!n.readAt ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ali-red" /> : <span className="mt-1.5 size-2 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{n.title}</p>
                  {n.body ? <p className="line-clamp-2 text-sm text-neutral-500">{n.body}</p> : null}
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-neutral-400">
                    <Badge variant="outline" className="font-mono text-[10px]">{n.type}</Badge>
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {n.link ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={n.link} onClick={() => { if (!n.readAt) mark({ ids: [n.id] }, "Marked as read."); }}>
                        Open <ChevronRight className="size-3.5" />
                      </Link>
                    </Button>
                  ) : !n.readAt ? (
                    <Button size="sm" variant="ghost" onClick={() => mark({ ids: [n.id] }, "Marked as read.")}>Mark read</Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <p className="text-sm font-bold">Email preferences</p>
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
          <span>Order, price-drop and deal emails <span className="block text-xs text-neutral-500">Promotions and alerts for your wishlist.</span></span>
          <Switch checked={prefs?.priceAlerts ?? true} onCheckedChange={(v) => setPref("priceAlerts", v)} />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
          <span>Lifecycle emails <span className="block text-xs text-neutral-500">Cart reminders, review requests, win-back offers.</span></span>
          <Switch checked={prefs?.lifecycle ?? true} onCheckedChange={(v) => setPref("lifecycle", v)} />
        </label>
      </Card>
    </div>
  );
}
