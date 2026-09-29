"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useShow, useUpdate } from "@refinedev/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BackLink, ErrorState, SectionTitle, StatusBadge, TableSkeleton } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Dispute } from "@/lib/refine/types";

// Mirrors the API's forward-only ruling map.
const NEXT: Record<string, string[]> = {
  OPEN: ["UNDER_REVIEW", "RESOLVED_BUYER", "RESOLVED_SELLER", "CLOSED"],
  UNDER_REVIEW: ["RESOLVED_BUYER", "RESOLVED_SELLER", "CLOSED"],
  RESOLVED_BUYER: ["CLOSED"],
  RESOLVED_SELLER: ["CLOSED"],
  CLOSED: [],
};

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
          <Badge variant="outline" className="font-mono text-[10px]">{d.category.replace(/_/g, " ")}</Badge>
          <span className="text-xs text-neutral-400">opened {timeAgo(d.createdAt)}</span>
          {d.resolvedAt ? <span className="text-xs text-neutral-400">· ruled {timeAgo(d.resolvedAt)}</span> : null}
          <span className="ml-auto text-lg font-extrabold tabular-nums">{formatUSD(d.order.total)}</span>
        </div>
        <p className="mt-1 text-sm text-neutral-500">{d.buyer.email}</p>
        <p className="mt-3 rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
          <span className="font-semibold">Reason: </span>{d.reason}
        </p>

        {d.holds && d.holds.length > 0 ? (
          <>
            <Separator className="my-5" />
            <SectionTitle>Escrow holds ({d.holds.length})</SectionTitle>
            <div className="mt-2 overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Store</TableHead><TableHead>Gross</TableHead><TableHead>Commission</TableHead><TableHead>Net</TableHead><TableHead>Status</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {d.holds.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="max-w-32 truncate font-mono text-xs">{h.storeId}</TableCell>
                      <TableCell className="tabular-nums">{formatUSD(h.gross)}</TableCell>
                      <TableCell className="tabular-nums">{formatUSD(h.commission)}</TableCell>
                      <TableCell className="font-semibold tabular-nums">{formatUSD(h.net)}</TableCell>
                      <TableCell><StatusBadge value={h.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              Ruling for the buyer refunds the order and marks holds REFUNDED; ruling for the seller unfreezes and releases what&apos;s due.
            </p>
          </>
        ) : null}

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
        <SectionTitle>Resolve dispute</SectionTitle>        {(NEXT[d.status] ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">This dispute is closed — rulings are terminal.</p>
        ) : (
          <div className="flex max-w-2xl flex-col gap-2 sm:flex-row">
            <Select value={(NEXT[d.status] ?? []).includes(status) ? status : (NEXT[d.status] ?? [])[0]} onValueChange={setStatus}>
              <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(NEXT[d.status] ?? []).map((o) => (
                  <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Resolution note (posted to thread)" className="flex-1" />
            <Button
              disabled={mutation.isPending}
              className="bg-ali-red text-white hover:bg-ali-red-dark"
              onClick={() => mutate({ resource: "disputes", id, values: { status: (NEXT[d.status] ?? []).includes(status) ? status : (NEXT[d.status] ?? [])[0], message: message || undefined } })}
            >
              Save ruling
            </Button>
          </div>
        )}
        <p className="text-xs text-neutral-500">Buyer-wins rulings auto-refund the order; seller-wins rulings release frozen escrow.</p>
      </Card>

      {d.chats && d.chats.length > 0 ? (
        <Card className="space-y-3 p-6">
          <SectionTitle>Linked buyer–seller chats ({d.chats.reduce((a, c) => a + c.messages.length, 0)} messages)</SectionTitle>
          {d.chats.map((c) => (
            <div key={c.id} className="rounded-lg border p-3">
              <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <Badge variant="outline" className="font-mono text-[10px]">{c.type}</Badge>
                <span className="font-mono">{c.id.slice(0, 8)}…</span>
                {c.subject ? <span className="truncate">{c.subject}</span> : null}
                <Link href={`/ys-admin/chat/${c.id}`} className="ml-auto text-ali-red hover:underline">Full moderation view →</Link>
              </p>
              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {c.messages.length === 0 ? (
                  <p className="text-xs text-neutral-400">No messages yet.</p>
                ) : (
                  c.messages.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-[13px]",
                        m.senderId === d.buyerId
                          ? "mr-8 bg-sky-500/10"
                          : "ml-8 bg-neutral-100 dark:bg-neutral-800",
                        m.flagged && "ring-1 ring-amber-400"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className="mt-0.5 text-[10px] text-neutral-400">
                        {m.senderId === d.buyerId ? "buyer" : "seller"} · {timeAgo(m.createdAt)}
                        {m.flagged ? " · FLAGGED" : ""}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
