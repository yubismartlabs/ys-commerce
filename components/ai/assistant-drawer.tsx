"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  BadgePercent,
  Eye,
  Gift,
  ImageIcon,
  Package,
  RotateCcw,
  Scale,
  Search,
  Send,
  Sparkles,
  Star,
  Ticket,
  TriangleAlert,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
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

/** Keyword-matched icon so suggestion chips read visually, not just text. */
function iconForSuggestion(s: string): LucideIcon {
  const t = s.toLowerCase();
  if (/deal|sale|price|drop|cheap|under/.test(t)) return BadgePercent;
  if (/order|track|deliver|arriv|shipped/.test(t)) return Package;
  if (/compar|vs|versus|better|difference/.test(t)) return Scale;
  if (/gift/.test(t)) return Gift;
  if (/review|rating|stars/.test(t)) return Star;
  if (/coupon|discount|code|ship/.test(t)) return Ticket;
  if (/return|refund|exchange/.test(t)) return RotateCcw;
  return Sparkles;
}

function SuggestionChip({ text, onPick }: { text: string; onPick: (t: string) => void }) {
  return (
    <button
      onClick={() => onPick(text)}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs hover:border-ali-red hover:text-ali-red"
    >
      <ChipIcon icon={iconForSuggestion(text)} /> {text}
    </button>
  );
}

function ChipIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="size-3.5 text-ali-red" />;
}

function AssistantAvatar({ size = "size-5", icon = "size-3" }: { size?: string; icon?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ali-red to-ali-orange text-white", size)}>
      <Sparkles className={icon} />
    </span>
  );
}

/** Left push-drawer body: header, context badge, messages, suggestions, input. */
export function AssistantDrawer() {
  const { context, close } = useAssistant();
  const { aiEnabled, aiName } = usePublicSettings();
  const { status } = useSession();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [dealPicks, setDealPicks] = useState<AssistantProduct[]>([]);
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
    // Quota-free: live flash deals with images for the empty-state strip.
    fetch("/api/v1/deals?pageSize=6")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const rows = (j?.data ?? []) as Array<{
          live: boolean;
          dealPrice: number;
          product: {
            slug: string; title: string; image: string; price: number; compareAt: number | null;
            ratingAvg: number; ratingCount: number; soldCount: number; badge: string | null; freeShipping: boolean;
          };
        }>;
        setDealPicks(
          rows
            .filter((d) => d.live)
            .slice(0, 4)
            .map((d) => ({
              slug: d.product.slug,
              title: d.product.title,
              price: d.dealPrice,
              image: d.product.image,
              ratingAvg: d.product.ratingAvg,
              compareAt: d.product.price,
              soldCount: d.product.soldCount,
              ratingCount: d.product.ratingCount,
              badge: d.product.badge,
              freeShipping: d.product.freeShipping,
            }))
        );
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
          <AssistantAvatar size="size-12" icon="size-6" />
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
        <p className="flex items-center gap-1.5 border-b bg-white px-4 py-2 text-[11px] text-neutral-500" aria-live="polite">
          {context.productSlug ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Eye className="size-3.5 shrink-0 text-ali-red" />
              <span className="truncate">Viewing: {context.productSlug}</span>
            </span>
          ) : null}
          {context.productSlug && context.searchQuery ? <span aria-hidden>·</span> : null}
          {context.searchQuery ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Search className="size-3.5 shrink-0 text-ali-red" />
              <span className="truncate">Search: “{context.searchQuery}”</span>
            </span>
          ) : null}
        </p>
      ) : null}
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto bg-neutral-50 p-3" role="log" aria-label="Assistant conversation">
        {messages.length === 0 && !busy ? (
          <div className="space-y-3">
            <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-bold">
                <AssistantAvatar size="size-6" icon="size-3.5" />
                Hi, I&apos;m {aiName}
              </p>
              <p className="text-xs text-neutral-500">
                I can compare products, summarize reviews, check prices and track your orders. Try one:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <SuggestionChip key={s} text={s} onPick={send} />
                ))}
              </div>
            </div>
            {dealPicks.length > 0 ? (
              <div className="space-y-2 rounded-xl bg-white p-3 shadow-sm">
                <p className="flex items-center gap-1.5 text-xs font-bold">
                  <Zap className="size-3.5 fill-current text-ali-orange" /> Today&apos;s flash deals
                </p>
                <ProductCarousel items={dealPicks} />
              </div>
            ) : null}
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
                <AssistantAvatar />
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
                    <SuggestionChip key={s} text={s} onPick={send} />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        {busy ? (
          <div className="space-y-2" aria-label="Assistant is thinking">
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <AssistantAvatar />
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
                  <div className="flex aspect-square items-center justify-center bg-neutral-200">
                    <ImageIcon className="size-8 text-neutral-400" />
                  </div>
                  <div className="space-y-1.5 p-2">
                    <div className="h-2.5 w-full rounded bg-neutral-200" />
                    <div className="h-4 w-1/2 rounded bg-neutral-200" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {notice ? (
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> <span>{notice}</span>
          </p>
        ) : null}
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
      <AssistantAvatar size="size-7" icon="size-4" />
      <p className="flex-1 text-sm font-bold">{name}</p>
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close assistant">
        <X />
      </Button>
    </div>
  );
}
