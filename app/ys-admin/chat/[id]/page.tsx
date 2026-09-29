"use client";

import { use } from "react";
import { useShow } from "@refinedev/core";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BackLink, ErrorState, Field, SectionTitle, TableSkeleton } from "@/components/refine/ui";
import { timeAgo } from "@/lib/format";

type Detail = {
  id: string;
  type: string;
  subject: string | null;
  messageCount: number;
  envelopeCount: number;
  lastMessageAt: string;
  createdAt: string;
  blocked: boolean;
  reportedAt: string | null;
  reportReason: string | null;
  users: Array<{ id: string; name: string | null; email: string; role: string }>;
  order: { number: string; status: string; total: number } | null;
  product: { title: string; slug: string } | null;
  store: { name: string; slug: string } | null;
  activity: Array<{ senderId: string; createdAt: string }>;
};

export default function ChatInspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { query } = useShow<Detail>({ resource: "chat", id });
  const d = query.data?.data;

  if (query.isLoading) return (<><BackLink href="/ys-admin/chat" label="Message reports" /><Card className="p-0"><TableSkeleton rows={5} cols={2} /></Card></>);
  if (query.isError || !d) return (<><BackLink href="/ys-admin/chat" label="Message reports" /><Card className="p-0"><ErrorState message="Conversation not found." /></Card></>);

  const byDay = new Map<string, number>();
  for (const a of d.activity) {
    const day = new Date(a.createdAt).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const peak = Math.max(1, ...byDay.values());

  return (
    <div className="space-y-4">
      <BackLink href="/ys-admin/chat" label="Message reports" />
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-lg font-bold">{d.id.slice(0, 13)}…</h1>
          <Badge variant="outline" className="font-mono text-[10px]">{d.type}</Badge>
          {d.reportedAt ? <Badge variant="outline" className="bg-red-500/10 text-red-700">REPORTED</Badge> : null}
          {d.blocked ? <Badge variant="outline">BLOCKED</Badge> : null}
        </div>
        {d.reportedAt ? (
          <p className="rounded-lg bg-red-500/10 p-3 text-sm">
            <span className="font-semibold">Report ({timeAgo(d.reportedAt)}): </span>{d.reportReason}
          </p>
        ) : null}

        <Separator />
        <SectionTitle>Participants</SectionTitle>
        <ul className="mt-2 space-y-1 text-sm">
          {d.users.map((u) => (
            <li key={u.id} className="font-mono text-xs">
              {u.email} · {u.role} · {u.name ?? "—"}
            </li>
          ))}
        </ul>

        <SectionTitle>Context</SectionTitle>
        <dl className="mt-2 space-y-1.5 text-sm">
          <Field label="Subject">{d.subject ?? "—"}</Field>
          <Field label="Order">{d.order ? `${d.order.number} · ${d.order.status}` : "—"}</Field>
          <Field label="Product">{d.product ? d.product.title : "—"}</Field>
          <Field label="Store">{d.store ? d.store.name : "—"}</Field>
        </dl>

        <SectionTitle>Volume (metadata only)</SectionTitle>
        <dl className="mt-2 space-y-1.5 text-sm">
          <Field label="Messages">{d.messageCount} sealed · {d.envelopeCount} key envelopes</Field>
          <Field label="Window">{timeAgo(d.createdAt)} → {timeAgo(d.lastMessageAt)}</Field>
        </dl>
        {byDay.size > 0 ? (
          <div className="flex h-20 items-end gap-1">
            {[...byDay.entries()].sort().map(([day, n]) => (
              <div key={day} className="flex-1 rounded-t bg-neutral-300 dark:bg-neutral-700" style={{ height: `${Math.max(6, Math.round((n / peak) * 100))}%` }} title={`${day}: ${n}`} />
            ))}
          </div>
        ) : null}

        <p className="flex items-center gap-1.5 rounded-lg bg-neutral-100 p-3 text-xs text-neutral-500 dark:bg-neutral-800">
          <Lock className="size-3.5 shrink-0" />
          Bodies are end-to-end encrypted. To act: suspend accounts from Users, or ask a participant to export their transcript.
        </p>
      </Card>
    </div>
  );
}
