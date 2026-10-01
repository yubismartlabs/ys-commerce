"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/refine/ui";
import { QueryErrorCard } from "@/components/commerce/query-error";
import { apiGet } from "@/lib/api/client";
import { formatUSD, timeAgo } from "@/lib/format";
import { DisputeThread } from "@/components/disputes/dispute-thread";
import { useAccountBase } from "@/lib/account-url";

type Detail = {
  id: string;
  category: string;
  reason: string;
  status: string;
  createdAt: string;
  order: { number: string; total: number; status: string };
  messages: Array<{ id: string; author: string; body: string; createdAt: string }>;
};

function DisputeDetail({ id }: { id: string }) {
  const base = useAccountBase();
  const search = useSearchParams();
  // ?view=selling renders the store side of the same dispute (seller reply
  // endpoint + "against my store" copy). One route, two perspectives.
  const selling = search.get("view") === "selling";
  const queryClient = useQueryClient();
  const endpoint = selling ? `/api/v1/account/selling/disputes/${id}` : `/api/v1/account/disputes/${id}`;
  const query = useQuery({
    queryKey: ["account-dispute", selling ? "selling" : "buying", id],
    queryFn: () => apiGet<Detail>(endpoint),
    retry: false,
  });
  const d = query.data;
  const canReply = !!d && ["OPEN", "UNDER_REVIEW"].includes(d.status);
  const backHref = selling ? `${base}/disputes?view=selling` : `${base}/disputes`;

  if (query.isLoading) return <Card className="p-6 text-sm text-neutral-500">Loading dispute…</Card>;
  if (query.isError || !d) {
    return <QueryErrorCard error={query.error} what="dispute" backHref={backHref} onRetry={() => query.refetch()} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link href={backHref}><ArrowLeft className="size-4" /> {selling ? "Store disputes" : "My disputes"}</Link>
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
          <span className="font-semibold">{selling ? "Buyer reports: " : "Issue: "}</span>{d.reason}
        </p>
        <Separator />
        <DisputeThread
          messages={d.messages}
          replyEndpoint={endpoint}
          canReply={canReply}
          onReplied={() => queryClient.invalidateQueries({ queryKey: ["account-dispute", selling ? "selling" : "buying", id] })}
        />
      </Card>
    </div>
  );
}

export default function DisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<Card className="p-6 text-sm text-neutral-500">Loading dispute…</Card>}>
      <DisputeDetail id={id} />
    </Suspense>
  );
}
