"use client";

import { use, useState } from "react";
import { useShow, useUpdate } from "@refinedev/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { BackLink, ErrorState, SectionTitle, StatusBadge, TableSkeleton } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Dispute } from "@/lib/refine/types";

const outcomes = ["UNDER_REVIEW", "RESOLVED_BUYER", "RESOLVED_SELLER", "CLOSED"] as const;

export default function DisputeShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { query } = useShow<Dispute>({ resource: "disputes", id });
  const { mutate, mutation } = useUpdate();
  const [status, setStatus] = useState<string>("RESOLVED_BUYER");
  const [message, setMessage] = useState("");
  const d = query.data?.data;

  if (query.isLoading) return (<><BackLink href="/ys-admin/disputes" label="Disputes" /><Card className="p-0"><TableSkeleton rows={6} cols={2} /></Card></>);
  if (query.isError || !d) return (<><BackLink href="/ys-admin/disputes" label="Disputes" /><Card className="p-0"><ErrorState message="Dispute not found." /></Card></>);

  return (
    <div className="space-y-4">
      <BackLink href="/ys-admin/disputes" label="Disputes" />
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-bold">Order {d.order.number}</h1>
          <StatusBadge value={d.status} />
          <span className="text-xs text-neutral-400">opened {timeAgo(d.createdAt)}</span>
          <span className="ml-auto text-lg font-extrabold tabular-nums">{formatUSD(d.order.total)}</span>
        </div>
        <p className="mt-1 text-sm text-neutral-500">{d.buyer.email}</p>
        <p className="mt-3 rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
          <span className="font-semibold">Reason: </span>{d.reason}
        </p>

        <Separator className="my-5" />
        <SectionTitle>Thread ({d.messages.length})</SectionTitle>
        <div className="mt-3 space-y-3">
          {d.messages.map((m) => {
            const mine = m.author === "admin";
            return (
              <div key={m.id} className={cn("flex", mine && "justify-end")}>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm",
                  mine
                    ? "rounded-br-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "rounded-bl-md bg-neutral-100 dark:bg-neutral-800"
                )}>
                  <p className={cn("mb-0.5 text-[11px] font-bold uppercase tracking-wide", mine ? "text-white/60 dark:text-neutral-500" : "text-neutral-400")}>
                    {m.author}
                  </p>
                  <p>{m.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-3 p-6">
        <SectionTitle>Resolve dispute</SectionTitle>
        <div className="flex max-w-2xl flex-col gap-2 sm:flex-row">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {outcomes.map((o) => (
                <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Resolution note (posted to thread)" className="flex-1" />
          <Button
            disabled={mutation.isPending}
            className="bg-ali-red text-white hover:bg-ali-red-dark"
            onClick={() => mutate({ resource: "disputes", id, values: { status, message: message || undefined } })}
          >
            Save ruling
          </Button>
        </div>
      </Card>
    </div>
  );
}
