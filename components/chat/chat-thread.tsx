"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Ban, Flag, ImagePlus, Loader2, Lock, Reply, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/refine/ui";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useChat } from "@/components/chat/use-chat";

async function act(path: string, body: object) {
  const res = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Action failed.");
}

/**
 * Full E2EE thread: decrypted bubbles, encrypted image attach, replies,
 * typing indicator, seen receipts, block/report. Plaintext never leaves tab.
 */
export function ChatThread({ conversationId, userId }: { conversationId: string; userId: string }) {
  const chat = useChat(conversationId, userId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [image, setImage] = useState<{ blob: Blob; name: string; preview: string } | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const d = chat.detail;
  const blocked = !!d?.blockedById;

  const submit = async () => {
    if ((!draft.trim() && !image) || sending) return;
    setSending(true);
    try {
      await chat.send(draft, image ?? undefined, replyTo ?? undefined);
      setDraft("");
      setImage(null);
      setReplyTo(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setSending(false);
    }
  };

  const onAction = async (body: object, msg: string) => {
    try {
      await act(`/api/v1/chat/conversations/${conversationId}`, body);
      toast.success(msg);
      chat.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    }
  };

  if (chat.detailLoading) return <Card className="p-6 text-sm text-neutral-500">Loading conversation…</Card>;
  if (chat.detailError || !d) {
    return <Card className="p-6 text-sm text-neutral-500">Conversation not found.</Card>;
  }
  if (chat.keyError === "peer-not-ready") {
    return (
      <Card className="mx-auto max-w-md space-y-2 p-6 text-center">
        <Lock className="mx-auto size-8 text-neutral-400" />
        <p className="font-bold">Waiting for {d.other?.name ?? "the other side"}</p>
        <p className="text-sm text-neutral-500">
          They haven&apos;t set up private chat yet. Your invite appears as soon as they unlock chat — nothing is sent in the clear meanwhile.
        </p>
      </Card>
    );
  }
  if (chat.keyError) {
    return <Card className="p-6 text-sm text-red-600">Encryption error: {chat.keyError}</Card>;
  }

  const replyTarget = replyTo ? chat.messages.find((m) => m.id === replyTo) : null;
  const lastOwn = [...chat.messages].reverse().find((m) => m.mine);
  const seen = lastOwn && d.readStates.some((r) => r.userId !== userId && new Date(r.lastReadAt) >= new Date(lastOwn.createdAt));

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-2 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">
            {d.other?.name ?? d.other?.email ?? "Chat"}
            {d.type === "ORDER" && d.order ? <span className="ml-2 font-mono text-sm font-medium text-neutral-500">{d.order.number}</span> : null}
          </p>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
            <Badge variant="outline" className="font-mono text-[10px]">{d.type}</Badge>
            {d.order ? <StatusBadge value={d.order.status} /> : null}
            {d.store ? <span>{d.store.name}</span> : null}
            <span className="inline-flex items-center gap-1 text-emerald-600"><Lock className="size-3" /> End-to-end encrypted</span>
          </p>
        </div>
        {!blocked ? (
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => onAction({ action: "block" }, "Blocked. They can no longer message you.")}>
              <Ban className="size-3.5" /> Block
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-xs"
              onClick={() => {
                const reason = window.prompt("Report this conversation (metadata only — admins can't read messages):");
                if (reason) void onAction({ action: "report", reason }, "Reported. Thanks.");
              }}
            >
              <Flag className="size-3.5" /> Report
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => onAction({ action: "unblock" }, "Unblocked.")}>
            <Undo2 className="size-3.5" /> Unblock
          </Button>
        )}
      </Card>

      <Card className="space-y-1 p-4">
        {chat.messagesLoading ? (
          <p className="py-4 text-center text-sm text-neutral-500">Decrypting…</p>
        ) : chat.messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">
            No messages yet. Say hello — only the two of you can read this thread.
          </p>
        ) : (
          chat.messages.map((m) => (
            <div key={m.id} className={cn("flex", m.mine && "justify-end")}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm",
                m.mine
                  ? "rounded-br-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "rounded-bl-md bg-neutral-100 dark:bg-neutral-800"
              )}>
                {m.imageObjectUrl ? (
                  <a href={m.imageObjectUrl} target="_blank" rel="noreferrer" className="block">
                    <span className="relative block h-40 w-40 overflow-hidden rounded-lg">
                      <Image src={m.imageObjectUrl} alt="attachment" fill className="object-cover" unoptimized />
                    </span>
                  </a>
                ) : null}
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className="mt-1 flex items-center gap-2 text-[11px] opacity-60">
                  <span>{timeAgo(m.createdAt)}</span>
                  {!m.mine ? (
                    <button className="inline-flex items-center gap-0.5 hover:opacity-100" onClick={() => setReplyTo(m.id)}>
                      <Reply className="size-3" /> Reply
                    </button>
                  ) : null}
                </p>
              </div>
            </div>
          ))
        )}
        {chat.peerTyping ? <p className="animate-pulse text-xs text-neutral-400">Typing…</p> : null}
        {seen ? <p className="text-right text-[11px] text-neutral-400">Seen</p> : null}
      </Card>

      {blocked ? (
        <Card className="p-4 text-center text-sm text-neutral-500">This conversation is blocked.</Card>
      ) : (
        <Card className="space-y-2 p-3">
          {replyTarget ? (
            <p className="flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs dark:bg-neutral-800">
              <Reply className="size-3.5" />
              <span className="flex-1 truncate">Replying: {replyTarget.text}</span>
              <button className="font-bold" onClick={() => setReplyTo(null)}>×</button>
            </p>
          ) : null}
          {image ? (
            <p className="flex items-center gap-2 text-xs">
              <span className="relative block size-14 overflow-hidden rounded-lg">
                <Image src={image.preview} alt="" fill className="object-cover" unoptimized />
              </span>
              {image.name}
              <button className="font-bold" onClick={() => setImage(null)}>×</button>
            </p>
          ) : null}
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 5 * 1024 * 1024) {
                  toast.error("Images must be 5MB or smaller.");
                  return;
                }
                setImage({ blob: f, name: f.name, preview: URL.createObjectURL(f) });
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="icon" onClick={() => fileRef.current?.click()} aria-label="Attach image">
              <ImagePlus className="size-4" />
            </Button>
            <Textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                chat.pingTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder={chat.convKey ? "Write a sealed message…" : "Exchanging keys…"}
              rows={2}
              className="flex-1"
              disabled={!chat.convKey}
            />
            <Button onClick={() => void submit()} disabled={sending || (!draft.trim() && !image) || !chat.convKey} aria-label="Send">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
          <p className="text-[11px] text-neutral-400">Sealed on this device before upload. Not even ys-commerce can read it.</p>
        </Card>
      )}
    </div>
  );
}
