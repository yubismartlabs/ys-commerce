"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Lock, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  type: string;
  subject: string | null;
  lastMessageAt: string;
  messageCount: number;
  unread: number;
  iAmBuyer: boolean;
  other: { name: string | null; email: string } | null;
  store: { name: string } | null;
  order: { number: string } | null;
  product: { title: string } | null;
};

function List({ basePath }: { basePath: string }) {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const query = useQuery({
    queryKey: ["chat-list"],
    queryFn: async (): Promise<Row[]> => {
      const res = await fetch("/api/v1/chat/conversations?pageSize=50");
      if (!res.ok) throw new Error("Couldn't load conversations.");
      return (await res.json()).data as Row[];
    },
  });
  const rows = (query.data ?? []).filter((r) => (filter === "unread" ? r.unread > 0 : true));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold"><MessageCircle className="size-5" /> Messages</h1>
        <div className="flex gap-1.5">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} className="rounded-full" onClick={() => setFilter("all")}>All</Button>
          <Button size="sm" variant={filter === "unread" ? "default" : "outline"} className="rounded-full" onClick={() => setFilter("unread")}>Unread</Button>
        </div>
      </div>
      <Card className="px-4 py-1">
        {query.isLoading ? (
          <p className="py-4 text-sm text-neutral-500">Loading…</p>
        ) : query.isError ? (
          <p className="py-4 text-sm text-neutral-500">Couldn&apos;t load conversations.</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">
            No conversations yet. Message a seller from any order, product, or store page.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`${basePath}/${r.id}`} className="flex items-center gap-3 py-3">
                  {!r.unread ? <span className="size-2 shrink-0" /> : <span className="size-2 shrink-0 rounded-full bg-ali-red" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {r.other?.name ?? r.other?.email ?? "Chat"}
                      {r.order ? <span className="ml-2 font-mono font-medium text-neutral-500">{r.order.number}</span> : null}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {r.type === "ORDER" ? "Order chat" : (r.subject ?? r.product?.title ?? "Product inquiry")}
                      {r.store ? ` · ${r.store.name}` : ""}
                      {r.unread > 0 ? ` · ${r.unread} new` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">{r.type}</Badge>
                  <span className="shrink-0 text-[11px] text-neutral-400">{timeAgo(r.lastMessageAt)}</span>
                  <ChevronRight className="size-4 shrink-0 text-neutral-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className={cn("flex items-center gap-1.5 text-xs text-neutral-400")}>
        <Lock className="size-3.5" /> Sealed at rest · trust & safety can review reported threads.
      </p>
    </div>
  );
}

export function ChatInbox({ basePath }: { basePath: string }) {
  const { data: session, status } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (status === "loading") return <Card className="p-6 text-sm text-neutral-500">Loading…</Card>;
  if (!userId) {
    return (
      <Card className="space-y-2 p-6 text-center text-sm text-neutral-500">
        <p>Sign in to view messages.</p>
        <Button size="sm" asChild><Link href="/sign-in">Sign in</Link></Button>
      </Card>
    );
  }
  return (
    <List basePath={basePath} />
  );
}
