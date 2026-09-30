"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePublicSettings } from "@/lib/public-settings";
import { useAssistant } from "@/lib/store/assistant";
import { cn } from "@/lib/utils";
import { AssistantText, isCompareAnswer, splitVerdict } from "@/components/ai/assistant-markdown";
import { CompareTable, ProductCarousel, type AssistantProduct } from "@/components/ai/assistant-products";

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  time: number;
  citations?: AssistantProduct[];
  compare?: boolean;
};

/** Left push-drawer body: header, context badge, messages, suggestions, input. */
export function AssistantDrawer() {
  const { context, close } = useAssistant();
  const { aiEnabled, aiName } = usePublicSettings();
  const { status } = useSession();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
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

  // Every known product title, for (slug) linkification in answers.
  const titles = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of messages) {
      for (const c of m.citations ?? []) map.set(c.slug.toLowerCase(), c.title);
    }
    return map;
  }, [messages]);

  const lastAssistantIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  }, [messages]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setNotice(null);
    const userMsg: ChatMsg = {
      role: "user",
      content,
      // eslint-disable-next-line react-hooks/purity -- event handler, not render
      time: Date.now(),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-12).map((m) => ({ role: m.role, content: m.content })),
          context,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok && !json?.data?.reply) {
        throw new Error(json?.error?.message ?? "Assistant unavailable.");
      }
      const citations = (Array.isArray(json.data.citations) ? json.data.citations : []) as AssistantProduct[];
      setMessages([
        ...next,
        {
          role: "assistant",
          content: json.data.reply as string,
          // eslint-disable-next-line react-hooks/purity -- event handler, not render
          time: Date.now(),
          citations,
          compare: isCompareAnswer(content, citations.length),
        },
      ]);
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
        <DrawerHeader name={aiName} onClose={close} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Sparkles className="size-8 text-ali-red" />
          <p className="text-sm font-semibold">Sign in for {aiName}</p>
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
        <DrawerHeader name={aiName} onClose={close} />
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-neutral-500">
          {aiName} is off. An admin can enable it in System settings → AI Assistant.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <DrawerHeader name={aiName} onClose={close} />
      {context.productSlug || context.searchQuery ? (
        <p className="border-b px-4 py-2 text-[11px] text-neutral-500" aria-live="polite">
          {context.productSlug ? `Viewing: ${context.productSlug}` : null}
          {context.productSlug && context.searchQuery ? " · " : null}
          {context.searchQuery ? `Search: “${context.searchQuery}”` : null}
        </p>
      ) : null}
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto bg-neutral-50 p-3" role="log" aria-label="Assistant conversation">
        {messages.length === 0 && !busy ? (
          <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <span className="flex size-6 items-center justify-center rounded-full bg-ali-red text-white">
                <Sparkles className="size-3.5" />
              </span>
              Hi, I&apos;m {aiName}
            </p>
            <p className="text-xs text-neutral-500">
              I can compare products, summarize reviews, check prices and track your orders. Try one:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border bg-white px-2.5 py-1 text-xs hover:border-ali-red hover:text-ali-red"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <div key={i} className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-neutral-900 px-3 py-2 text-sm text-white">
                {m.content}
              </div>
            );
          }
          const { body, verdict } = m.compare ? splitVerdict(m.content) : { body: m.content, verdict: undefined };
          const showFollowups = i === lastAssistantIdx && !busy && suggestions.length > 0;
          return (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                <span className="flex size-5 items-center justify-center rounded-full bg-ali-red text-white">
                  <Sparkles className="size-3" />
                </span>
                <span className="font-semibold text-neutral-700">{aiName}</span>
                <span>·</span>
                <time>{new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              </div>
              <div className="rounded-2xl rounded-tl-md bg-white px-3 py-2.5 text-sm shadow-sm">
                <AssistantText text={body} titles={titles} />
              </div>
              {m.citations && m.citations.length > 0 ? (
                m.compare ? (
                  <CompareTable items={m.citations} verdict={verdict} />
                ) : (
                  <ProductCarousel items={m.citations} />
                )
              ) : null}
              {showFollowups ? (
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5" aria-label="Follow-up questions">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="shrink-0 rounded-full border bg-white px-2.5 py-1 text-xs hover:border-ali-red hover:text-ali-red"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        {busy ? (
          <div className="space-y-2" aria-label="Assistant is thinking">
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <span className="flex size-5 items-center justify-center rounded-full bg-ali-red text-white">
                <Sparkles className="size-3" />
              </span>
              <span className="font-semibold text-neutral-700">{aiName}</span>
            </div>
            <div className="animate-pulse space-y-1.5 rounded-2xl rounded-tl-md bg-white p-3 shadow-sm">
              <div className="h-2.5 w-11/12 rounded bg-neutral-200" />
              <div className="h-2.5 w-3/4 rounded bg-neutral-200" />
              <div className="h-2.5 w-2/3 rounded bg-neutral-200" />
            </div>
            <div className="flex gap-2">
              {[0, 1].map((k) => (
                <div key={k} className="w-[168px] shrink-0 animate-pulse overflow-hidden rounded-xl border bg-white">
                  <div className="aspect-square bg-neutral-200" />
                  <div className="space-y-1.5 p-2">
                    <div className="h-2.5 w-full rounded bg-neutral-200" />
                    <div className="h-4 w-1/2 rounded bg-neutral-200" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {notice ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</p> : null}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t bg-white p-3"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about products, deals, orders…"
          aria-label={`Ask ${aiName}`}
          className={cn("h-10 flex-1 rounded-full border px-3 text-sm outline-none focus:border-ali-red")}
          maxLength={2000}
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send" className="bg-ali-red text-white hover:bg-ali-red-dark">
          <Send className="size-4" />
        </Button>
      </form>
      <p className="border-t bg-white px-4 py-1.5 text-[10px] text-neutral-400">AI can make mistakes — the product page is authoritative.</p>
    </div>
  );
}

function DrawerHeader({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
      <Sparkles className="size-4 text-ali-red" />
      <p className="flex-1 text-sm font-bold">{name}</p>
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close assistant">
        <X />
      </Button>
    </div>
  );
}
