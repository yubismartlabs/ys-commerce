"use client";

import { use } from "react";
import { useShow, useUpdate } from "@refinedev/core";
import Image from "next/image";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BackLink, ErrorState, SectionTitle, StatusBadge, TableSkeleton } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/refine/types";

const STEPS = ["PENDING", "PAID", "SHIPPED", "DELIVERED"] as const;

export default function OrderShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { query } = useShow<Order>({ resource: "orders", id });
  const { mutate, mutation } = useUpdate();
  const o = query.data?.data;

  if (query.isLoading) return (<><BackLink href="/ys-admin/orders" label="Orders" /><Card className="p-0"><TableSkeleton rows={6} cols={2} /></Card></>);
  if (query.isError || !o) return (<><BackLink href="/ys-admin/orders" label="Orders" /><Card className="p-0"><ErrorState message="Order not found." /></Card></>);

  const stepIdx = STEPS.indexOf(o.status as (typeof STEPS)[number]);
  const done = stepIdx >= 0 ? stepIdx + 1 : o.status === "DELIVERED" ? 4 : 0;

  return (
    <div className="space-y-4">
      <BackLink href="/ys-admin/orders" label="Orders" />
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-bold">Order {o.number}</h1>
          <StatusBadge value={o.status} />
          <span className="text-xs text-neutral-400">placed {timeAgo(o.createdAt)}</span>
          <span className="ml-auto text-2xl font-black tabular-nums">{formatUSD(o.total)}</span>
        </div>

        {(o.status === "REFUNDED" || o.status === "CANCELLED") ? null : (
          <div className="mt-5 flex items-center">
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
        )}

        <Separator className="my-5" />
        <SectionTitle>Items ({o.items.reduce((a, i) => a + i.qty, 0)})</SectionTitle>
        <div className="mt-2 divide-y">
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

        <Separator className="my-5" />
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-neutral-500"><dt>Subtotal</dt><dd className="tabular-nums">{formatUSD(o.subtotal)}</dd></div>
          <div className="flex justify-between text-neutral-500"><dt>Shipping</dt><dd className="tabular-nums">{formatUSD(o.shipping)}</dd></div>
          <div className="flex justify-between font-bold"><dt>Total ({o.currency})</dt><dd className="tabular-nums">{formatUSD(o.total)}</dd></div>
        </dl>

        {o.status !== "REFUNDED" && o.status !== "CANCELLED" && (
          <div className="flex gap-2 pt-4">
            <Button size="sm" variant="destructive" disabled={mutation.isPending} onClick={() => mutate({ resource: "orders", id, values: { status: "REFUNDED" } })}>Refund order</Button>
            <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutate({ resource: "orders", id, values: { status: "CANCELLED" } })}>Cancel order</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
