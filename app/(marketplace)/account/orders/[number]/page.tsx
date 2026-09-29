"use client";

import { use } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";
import { FileDisputeDialog } from "@/components/disputes/file-dispute-dialog";
import { MessageButton } from "@/components/chat/message-button";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/refine/types";

const STEPS = ["PENDING", "PAID", "SHIPPED", "DELIVERED"] as const;

async function fetchOrder(number: string): Promise<Order> {
  const res = await fetch(`/api/v1/account/orders/${encodeURIComponent(number)}`);
  if (!res.ok) throw new Error("Order not found.");
  return (await res.json()).data as Order;
}

export default function BuyerOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const query = useQuery({
    queryKey: ["account-order", number],
    queryFn: () => fetchOrder(decodeURIComponent(number)),
    retry: false,
  });
  const o = query.data;

  if (query.isLoading) return <Card className="p-6 text-sm text-neutral-500">Loading order…</Card>;
  if (query.isError || !o) {
    return (
      <Card className="space-y-2 p-6 text-sm text-neutral-500">
        <p>Order not found.</p>
        <Button size="sm" variant="outline" asChild><Link href="/account">Back to my orders</Link></Button>
      </Card>
    );
  }

  const stepIdx = STEPS.indexOf(o.status as (typeof STEPS)[number]);
  const done = stepIdx >= 0 ? stepIdx + 1 : 0;
  const events = (o.events ?? []).filter((e) => e.type !== "NOTE");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link href="/account"><ArrowLeft className="size-4" /> My orders</Link>
      </Button>
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-bold">{o.number}</h1>
          <StatusBadge value={o.status} />
          <span className="ml-auto text-xl font-black tabular-nums">{formatUSD(o.total)}</span>
        </div>
        {(o.stores ?? []).length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {(o.stores ?? []).map((s: { id: string; name: string }) => (
              <MessageButton
                key={s.id}
                orderId={o.id}
                storeId={s.id}
                label={`Message ${s.name}`}
                basePath="/account/messages"
              />
            ))}
          </div>
        ) : null}
        {o.protectionUntil && new Date(o.protectionUntil) > new Date() && o.status === "DELIVERED" ? (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-4 shrink-0" />
            Buyer protection until {new Date(o.protectionUntil).toLocaleDateString()}
            <span className="ml-auto"><FileDisputeDialog orderNumber={o.number} /></span>
          </p>
        ) : o.status === "PAID" || o.status === "SHIPPED" ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-neutral-400">Something wrong? You can dispute undelivered orders too.</p>
            <FileDisputeDialog orderNumber={o.number} />
          </div>
        ) : null}

        {o.status !== "REFUNDED" && o.status !== "CANCELLED" ? (
          <div className="flex items-center">
            {STEPS.map((s, i) => (
              <div key={s} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[11px] font-bold",
                    i < done ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-500 dark:bg-neutral-700"
                  )}>
                    {i < done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className={cn("hidden text-xs font-medium sm:block", i < done ? "" : "text-neutral-400")}>{s}</span>
                </div>
                {i < STEPS.length - 1 ? <span className={cn("mx-2 h-px flex-1", i < done - 1 ? "bg-emerald-500" : "bg-neutral-200 dark:bg-neutral-700")} /> : null}
              </div>
            ))}
          </div>
        ) : null}

        {(o.trackingNumber || o.carrier) && (
          <p className="rounded-lg bg-neutral-100 p-3 font-mono text-sm dark:bg-neutral-800">
            Tracking: {o.trackingNumber ?? "—"}{o.carrier ? ` via ${o.carrier}` : ""}
          </p>
        )}

        <Separator />
        <div className="divide-y">
          {o.items.map((i) => (
            <div key={i.id} className="flex items-center gap-3 py-2.5">
              <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                <Image src={i.image} alt="" fill sizes="44px" className="object-cover" />
              </span>
              <p className="line-clamp-2 min-w-0 flex-1 text-sm">{i.title}{i.variant ? <span className="text-neutral-400"> · {i.variant}</span> : null}</p>
              <p className="shrink-0 text-sm tabular-nums text-neutral-500">×{i.qty}</p>
              <p className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">{formatUSD(i.price)}</p>
            </div>
          ))}
        </div>

        <Separator />
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-neutral-500"><dt>Subtotal</dt><dd className="tabular-nums">{formatUSD(o.subtotal)}</dd></div>
          <div className="flex justify-between text-neutral-500"><dt>Shipping</dt><dd className="tabular-nums">{formatUSD(o.shipping)}</dd></div>
          {(o.discount ?? 0) > 0 ? (
            <div className="flex justify-between text-emerald-600"><dt>Coupon {o.couponCode}</dt><dd className="tabular-nums">−{formatUSD(o.discount ?? 0)}</dd></div>
          ) : null}
          <div className="flex justify-between font-bold"><dt>Total</dt><dd className="tabular-nums">{formatUSD(o.total)}</dd></div>
          <div className="flex justify-between text-neutral-500"><dt>Ship to</dt><dd className="text-right">{o.shipName ?? "—"}, {o.shipCity ?? "—"}</dd></div>
        </dl>

        {events.length > 0 ? (
          <>
            <Separator />
            <ol>
              {events.map((e, i) => (
                <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < events.length - 1 ? <span className="absolute left-[5px] top-4 h-full w-px bg-neutral-200 dark:bg-neutral-700" /> : null}
                  <span className="mt-1 size-[11px] shrink-0 rounded-full bg-emerald-500" />
                  <div className="min-w-0">
                    <p className="text-sm">
                      <Badge variant="outline" className="mr-2 font-mono text-[10px]">{e.type}</Badge>
                      <span className="text-neutral-500">{e.message ?? ""}</span>
                    </p>
                    <p className="text-xs text-neutral-400">{timeAgo(e.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </Card>
    </div>
  );
}
