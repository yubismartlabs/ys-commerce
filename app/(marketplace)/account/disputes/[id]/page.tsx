"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/refine/ui";
import { QueryErrorCard } from "@/components/commerce/query-error";
import { apiGet } from "@/lib/api/client";
import { formatUSD, timeAgo } from "@/lib/format";
import { DisputeThread } from "@/components/disputes/dispute-thread";

type Detail = {
  id: string;
  category: string;
  reason: string;
  status: string;
  createdAt: string;
  order: { number: string; total: number; status: string };
  messages: Array<{ id: string; author: string; body: string; createdAt: string }>;
};

export default function BuyerDisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["account-dispute", id],
    queryFn: () => apiGet<Detail>(`/api/v1/account/disputes/${id}`),
    retry: false,
  });
  const d = query.data;
  const canReply = !!d && ["OPEN", "UNDER_REVIEW"].includes(d.status);

  if (query.isLoading) return <Card className="p-6 text-sm text-neutral-500">Loading dispute…</Card>;
  if (query.isError || !d) {
    return <QueryErrorCard error={query.error} what="dispute" backHref="/account/disputes" onRetry={() => query.refetch()} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link href="/account/disputes"><ArrowLeft className="size-4" /> My disputes</Link>
      </Button>
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold">Order {d.order.number}</h1>
          <StatusBadge value={d.status} />
          <StatusBadge value={d.category} />
          <span className="ml-auto font-bold tabular-nums">{formatUSD(d.order.total)}</span>
        </div>
        <p className="text-xs text-neutral-400">Opened {timeAgo(d.createdAt)} · funds frozen in escrow until ruling</p>
        <p className="rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
          <span className="font-semibold">Issue: </span>{d.reason}
        </p>
        <Separator />
        <DisputeThread
          messages={d.messages}
          replyEndpoint={`/api/v1/account/disputes/${id}`}
          canReply={canReply}
          onReplied={() => queryClient.invalidateQueries({ queryKey: ["account-dispute", id] })}
        />
      </Card>
    </div>
  );
}
