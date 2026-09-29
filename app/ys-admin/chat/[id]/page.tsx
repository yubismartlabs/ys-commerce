"use client";

import { use } from "react";
import Link from "next/link";
import { useShow } from "@refinedev/core";
import { Eye, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BackLink, ErrorState, Field, SectionTitle, TableSkeleton } from "@/components/refine/ui";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type Detail = {
  id: string;
  type: string;
  subject: string | null;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
  blocked: boolean;
  reportedAt: string | null;
  reportReason: string | null;
  users: Array<{ id: string; name: string | null; email: string; role: string }>;
  order: { number: string; status: string; total: number } | null;
  product: { title: string; slug: string } | null;
  store: { name: string; slug: string } | null;
  transcript: Array<{
    id: string;
    senderId: string;
    text: string;
    imageUrl: string | null;
    flagged: boolean;
    flaggedKinds: string[];
    createdAt: string;
  }>;
};

export default function ChatInspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { query } = useShow<Detail>({ resource: "chat", id });
  const d = query.data?.data;

  if (query.isLoading) return (<><BackLink href="/ys-admin/chat" label="Message reports" /><Card className="p-0"><TableSkeleton rows={5} cols={2} /></Card></>);
  if (query.isError || !d) return (<><BackLink href="/ys-admin/chat" label="Message reports" /><Card className="p-0"><ErrorState message="Conversation not found." /></Card></>);

  const nameOf = (uid: string) => d.users.find((u) => u.id === uid)?.email ?? uid.slice(0, 8);

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

        <Separator />
        <SectionTitle>Transcript ({d.messageCount})</SectionTitle>
        <div className="mt-2 max-h-[480px] space-y-2 overflow-y-auto rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
          {d.transcript.length === 0 ? (
            <p className="text-sm text-neutral-500">No messages yet.</p>
          ) : (
            d.transcript.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-lg bg-white px-3 py-2 text-sm shadow-sm dark:bg-neutral-800",
                  m.flagged && "ring-1 ring-amber-400"
                )}
              >
                <p className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                  <span className="font-mono font-bold">{nameOf(m.senderId)}</span>
                  <span>{timeAgo(m.createdAt)}</span>
                  {m.flagged ? (
                    <Badge variant="outline" className="bg-amber-400/15 text-[10px] text-amber-700">
                      FLAGGED: {m.flaggedKinds.join(", ") || "review"}
                    </Badge>
                  ) : null}
                </p>
                {m.imageUrl ? (
                  <a href={m.imageUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-ali-red hover:underline">
                    [image attachment]
                  </a>
                ) : null}
                <p className="mt-0.5 whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {d.users.filter((u) => u.role !== "ADMIN").map((u) => (
            <Button key={u.id} size="sm" variant="outline" asChild>
              <Link href={`/ys-admin/users/show/${u.id}`}><Eye className="size-3.5" /> Inspect {u.email}</Link>
            </Button>
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-neutral-400">
          <Lock className="size-3.5" /> Sealed at rest; opened here for trust & safety review.
        </p>
      </Card>
    </div>
  );
}
