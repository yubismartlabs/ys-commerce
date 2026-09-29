"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ThreadMessage = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

const AUTHOR_TONE: Record<string, string> = {
  buyer: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  seller: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  admin: "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900",
};

/**
 * Shared dispute thread: colored bubbles per author + reply box.
 * Parent passes its own PATCH endpoint and refresh callback.
 */
export function DisputeThread({
  messages,
  replyEndpoint,
  canReply,
  onReplied,
}: {
  messages: ThreadMessage[];
  replyEndpoint: string;
  canReply: boolean;
  onReplied: () => void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      const res = await fetch(replyEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: body.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Reply failed.");
      setBody("");
      toast.success("Reply posted.");
      onReplied();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reply failed.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      {messages.length === 0 ? (
        <p className="text-sm text-neutral-500">No messages yet.</p>
      ) : (
        messages.map((m) => (
          <div key={m.id} className="flex">
            <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm", AUTHOR_TONE[m.author] ?? "bg-neutral-100 dark:bg-neutral-800")}>
              <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide opacity-70">{m.author}</p>
              <p>{m.body}</p>
              <p className="mt-1 text-[11px] opacity-60">{timeAgo(m.createdAt)}</p>
            </div>
          </div>
        ))
      )}
      {canReply ? (
        <div className="flex gap-2 pt-1">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply…" rows={2} className="flex-1" />
          <Button onClick={send} disabled={sending || !body.trim()} className="shrink-0">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-neutral-400">This dispute is closed to new messages.</p>
      )}
    </div>
  );
}
