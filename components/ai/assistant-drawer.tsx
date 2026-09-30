"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePublicSettings } from "@/lib/public-settings";
import { useAssistant } from "@/lib/store/assistant";
import { cn } from "@/lib/utils";

type ChatMsg = { role: "user" | "assistant"; content: string };
type Citation = { slug: string; title: string; price: number; image: string; ratingAvg: number };

function ProductCard({ c }: { c: Citation }) {
  return (
    <Link
      href={`/product/${c.slug}`}
      className="flex items-center gap-2 rounded-lg border bg-white p-2 hover:border-ali-red"
    >
      <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-neutral-100">
        <Image src={c.image} alt="" fill className="object-cover" sizes="40px" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{c.title}</span>
        <span className="text-xs font-bold text-ali-red">${c.price.toFixed(2)}</span>
        <span className="ml-1 text-[11px] text-neutral-500">★{c.ratingAvg.toFixed(1)}</span>
      </span>
    </Link>
  );
}

/** Left push-drawer body: header, context badge, messages, suggestions, input. */
export function AssistantDrawer() {
  const { context, close } = useAssistant();
  const { aiEnabled } = usePublicSettings();
  const { status } = useSession();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  useEffect(() => {
    if (status !== "authenticated" || !aiEnabled) return;
    const params = new URLSearchParams();
    if (context.productSlug) params.set("productSlug", context.productSlug);
    if (context.searchQuery) params.set("q", context.searchQuery);
    fetch(`/api/v1/ai/suggest?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data?.suggestions) setSuggestions(j.data.suggestions as string[]);
      })
      .catch(() => {});
  }, [context.productSlug, context.searchQuery, status, aiEnabled]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setNotice(null);
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12), context }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok && !json?.data?.reply) {
        throw new Error(json?.error?.message ?? "Assistant unavailable.");
      }
      setMessages([...next, { role: "assistant", content: json.data.reply as string }]);
      if (Array.isArray(json.data.citations)) setCitations(json.data.citations as Citation[]);
      if (!res.ok) setNotice("Degraded mode — catalog facts shown while the model recovers.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Assistant unavailable.");
    } finally {
      setBusy(false);
    }
  };

  if (status === "unauthenticated") {
    return (
      <div className="flex h-full flex-col">
        <DrawerHeader onClose={close} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Sparkles className="size-8 text-ali-red" />
          <p className="text-sm font-semibold">Sign in for the shopping assistant</p>
          <p className="text-xs text-neutral-500">Personalized answers, order help and recommendations need your account.</p>
          <Button asChild className="bg-ali-red text-white hover:bg-ali-red-dark">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!aiEnabled) {
    return (
      <div className="flex h-full flex-col">
        <DrawerHeader onClose={close} />
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-neutral-500">
          The shopping assistant is off. An admin can enable it in System settings → AI Assistant.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <DrawerHeader onClose={close} />
      {context.productSlug || context.searchQuery ? (
        <p className="border-b px-4 py-2 text-[11px] text-neutral-500" aria-live="polite">
          {context.productSlug ? `Viewing: ${context.productSlug}` : null}
          {context.productSlug && context.searchQuery ? " · " : null}
          {context.searchQuery ? `Search: “${context.searchQuery}”` : null}
        </p>
      ) : null}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-label="Assistant conversation">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="size-4 text-ali-red" /> How can I help you shop?
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border px-2.5 py-1 text-xs hover:border-ali-red hover:text-ali-red"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} className={cn("max-w-[92%] rounded-xl px-3 py-2 text-sm", m.role === "user" ? "ml-auto bg-neutral-100" : "bg-ali-red/5")}>
            {m.content}
          </div>
        ))}
        {busy ? (
          <p className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Loader2 className="size-3.5 animate-spin" /> Thinking…
          </p>
        ) : null}
        {citations.length > 0 && messages.length > 0 ? (
          <div className="space-y-1.5 pt-1">
            {citations.slice(0, 3).map((c) => (
              <ProductCard key={c.slug} c={c} />
            ))}
          </div>
        ) : null}
        {notice ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</p> : null}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t p-3"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about products, deals, orders…"
          aria-label="Ask the shopping assistant"
          className="h-10 flex-1 rounded-full border px-3 text-sm outline-none focus:border-ali-red"
          maxLength={2000}
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send" className="bg-ali-red text-white hover:bg-ali-red-dark">
          <Send className="size-4" />
        </Button>
      </form>
      <p className="border-t px-4 py-1.5 text-[10px] text-neutral-400">AI can make mistakes — the product page is authoritative.</p>
    </div>
  );
}

function DrawerHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b px-4 py-3">
      <Sparkles className="size-4 text-ali-red" />
      <p className="flex-1 text-sm font-bold">Shopping assistant</p>
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close assistant">
        <X />
      </Button>
    </div>
  );
}
