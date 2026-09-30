"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowDown,
  BadgePercent,
  Eye,
  Gift,
  ImageIcon,
  Package,
  Plus,
  RotateCcw,
  Scale,
  Search,
  Send,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
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
  id?: string;
  role: "user" | "assistant";
  content: string;
  time: number;
  citations?: AssistantProduct[];
  compare?: boolean;
  feedback?: 1 | -1 | null;
  /** Only live messages animate in — restored history appears settled. */
  fresh?: boolean;
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
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs shadow-sm transition hover:border-ali-red hover:text-ali-red active:scale-95"
    >
      <ChipIcon icon={iconForSuggestion(text)} /> {text}
    </button>
  );
}

function ChipIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="size-3.5 text-ali-red" />;
}

function HomeTile({
  icon: Icon,
  tint,
  title,
  hint,
  prompt,
  onPick,
}: {
  icon: LucideIcon;
  tint: string;
  title: string;
  hint: string;
  prompt: string;
  onPick: (t: string) => void;
}) {
  return (
    <button
      onClick={() => onPick(prompt)}
      className="group flex items-center gap-2.5 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-3 text-left transition hover:border-ali-red/30 hover:bg-white hover:shadow-sm active:scale-[0.97]"
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tint)}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-bold text-neutral-900">{title}</span>
        <span className="block truncate text-[11px] text-neutral-500">{hint}</span>
      </span>
    </button>
  );
}

function AssistantAvatar({ size = "size-5", icon = "size-3" }: { size?: string; icon?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ali-red to-ali-orange text-white shadow-sm", size)}>
      <Sparkles className={icon} />
    </span>
  );
}

/** "Today" / "Yesterday" / date divider for the persistent thread. */
function dayLabel(time: number): string {
  const d = new Date(time);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1" aria-hidden>
      <span className="h-px flex-1 bg-neutral-200/80" />
      <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 shadow-sm">
        {label}
      </span>
      <span className="h-px flex-1 bg-neutral-200/80" />
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1 py-1.5" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="ai-dot size-1.5 rounded-full bg-neutral-400"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  );
}

function FeedbackRow({
  messageId,
  value,
  onVote,
}: {
  messageId: string;
  value?: 1 | -1 | null;
  onVote: (id: string, v: 1 | -1) => void;
}) {
  const btn = (v: 1 | -1, label: string, Icon: LucideIcon) => (
    <button
      onClick={() => onVote(messageId, v)}
      aria-label={label}
      aria-pressed={value === v}
      title={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-full transition active:scale-90",
        value === v ? "bg-ali-red text-white shadow-sm" : "text-neutral-400 hover:bg-neutral-200/70 hover:text-neutral-600"
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
  return (
    <div className="flex items-center gap-0.5 pl-1" aria-label="Rate this answer">
      {btn(1, "Helpful", ThumbsUp)}
      {btn(-1, "Not helpful", ThumbsDown)}
    </div>
  );
}

/** Left push-drawer body: header, context badge, messages, suggestions, input. */
export function AssistantDrawer() {
  const { context, close } = useAssistant();
  const { aiEnabled, aiName } = usePublicSettings();
  const { data: session, status } = useSession();
  const firstName = session?.user?.name?.split(" ")[0]?.slice(0, 30);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [dealPicks, setDealPicks] = useState<AssistantProduct[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showLatest, setShowLatest] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pinnedRef = useRef(true);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Restore the persistent thread (Alexa-style continuity across sessions).
  useEffect(() => {
    if (status !== "authenticated" || !aiEnabled || loaded) return;
    fetch("/api/v1/ai/history")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const rows = (j?.data ?? []) as Array<{
          id: string; role: "user" | "assistant"; content: string;
          citations: AssistantProduct[]; feedback: 1 | -1 | null; createdAt: string;
        }>;
        let prevUser = "";
        setMessages(
          rows.map((r) => {
            const compare = r.role === "assistant" ? isCompareAnswer(prevUser, (r.citations ?? []).length) : undefined;
            if (r.role === "user") prevUser = r.content;
            return {
              id: r.id,
              role: r.role,
              content: r.content,
              time: new Date(r.createdAt).getTime(),
              citations: r.citations ?? [],
              compare,
              feedback: r.feedback,
            };
          })
        );
        setLoaded(true);
        requestAnimationFrame(() => {
          listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
        });
      })
      .catch(() => setLoaded(true));
  }, [status, aiEnabled, loaded]);

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

  // Seamless scroll: follow live messages only while pinned to the bottom.
  useEffect(() => {
    const el = listRef.current;
    if (!el || !pinnedRef.current) return;
    const fresh = messages.length > 0 && messages[messages.length - 1].fresh;
    el.scrollTo({ top: el.scrollHeight, behavior: fresh ? "smooth" : "auto" });
  }, [messages, busy]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    pinnedRef.current = pinned;
    setShowLatest(!pinned && messages.length > 0);
  };

  const jumpToLatest = () => {
    pinnedRef.current = true;
    setShowLatest(false);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  };

  // Every known product title, for clean title-only links in answers.
  const titles = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of messages) {
      for (const c of m.citations ?? []) map.set(c.slug.toLowerCase(), c.title);
    }
    for (const c of dealPicks) map.set(c.slug.toLowerCase(), c.title);
    return map;
  }, [messages, dealPicks]);

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
    pinnedRef.current = true;
    setShowLatest(false);
    const userMsg: ChatMsg = { role: "user", content, time: Date.now(), fresh: true };
    const next = [...messages, userMsg];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, context }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok && !json?.data?.reply) {
        throw new Error(json?.error?.message ?? "Assistant unavailable.");
      }
      const citations = (Array.isArray(json.data.citations) ? json.data.citations : []) as AssistantProduct[];
      setMessages([
        ...next,
        {
          id: (json.data.messageId as string | null) ?? undefined,
          role: "assistant",
          content: json.data.reply as string,
          time: Date.now(),
          citations,
          compare: isCompareAnswer(content, citations.length),
          fresh: true,
        },
      ]);
      if (!res.ok) setNotice("Degraded mode — catalog facts shown while the model recovers.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Assistant unavailable.");
    } finally {
      setBusy(false);
    }
  };

  const vote = async (id: string, v: 1 | -1) => {    const prev = messages;
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, feedback: m.feedback === v ? null : v } : m)));
    try {
      const res = await fetch("/api/v1/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: id, value: v }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Vote failed.");
      setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, feedback: (json.data.feedback as 1 | -1 | null) ?? null } : m)));
    } catch {
      setMessages(prev);
    }
  };

  const clear = async () => {
    if (busy || messages.length === 0) return;
    const prev = messages;
    setMessages([]);
    setNotice(null);
    pinnedRef.current = true;
    try {
      const res = await fetch("/api/v1/ai/history", { method: "DELETE" });
      if (!res.ok) throw new Error("clear");
    } catch {
      setMessages(prev);
    }
  };
  if (status === "unauthenticated") {
    return (
      <div className="flex h-full flex-col">
        <DrawerHeader name={aiName} onClose={close} onNewChat={undefined} />
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
        <DrawerHeader name={aiName} onClose={close} onNewChat={undefined} />
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-neutral-500">
          {aiName} is off. An admin can enable it in System settings → AI Assistant.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <DrawerHeader name={aiName} onClose={close} onNewChat={messages.length > 0 ? clear : undefined} />
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
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={listRef}
          onScroll={onScroll}
          className="ai-canvas h-full space-y-4 overflow-y-auto scroll-smooth p-3"
          role="log"
          aria-label="Assistant conversation"
        >
          {messages.length === 0 && !busy && loaded ? (
            <div className="ai-msg-in space-y-3">
              <div className="ai-card space-y-4 rounded-[22px] p-5 ring-1 ring-black/5">
                <div className="flex items-center gap-3">
                  <AssistantAvatar size="size-11" icon="size-6" />
                  <div>
                    <p className="text-[17px] font-extrabold tracking-tight text-neutral-900">
                      {firstName ? `Hi ${firstName}` : "Hi there"}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                      <span className="size-1.5 rounded-full bg-emerald-500" /> {aiName} is online
                    </p>
                  </div>
                </div>
                <p className="text-[13px] leading-6 text-neutral-500">
                  Your shopping companion — compare products, summarize reviews, check prices and track orders.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <HomeTile
                    icon={BadgePercent}
                    tint="bg-ali-red/10 text-ali-red"
                    title="Today's deals"
                    hint="Flash picks"
                    prompt="Show me today's flash deals"
                    onPick={send}
                  />
                  <HomeTile
                    icon={Package}
                    tint="bg-sky-100 text-sky-700"
                    title="My orders"
                    hint="Track & reorder"
                    prompt="Where is my recent order?"
                    onPick={send}
                  />
                  <HomeTile
                    icon={Scale}
                    tint="bg-violet-100 text-violet-700"
                    title="Compare"
                    hint="Side by side"
                    prompt="Compare the most popular products"
                    onPick={send}
                  />
                  <HomeTile
                    icon={Gift}
                    tint="bg-emerald-100 text-emerald-700"
                    title="Gift ideas"
                    hint="Under $20"
                    prompt="Help me find a gift under $20"
                    onPick={send}
                  />
                </div>
                {suggestions.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <SuggestionChip key={s} text={s} onPick={send} />
                    ))}
                  </div>
                ) : null}
              </div>
              {dealPicks.length > 0 ? (
                <div className="ai-card space-y-2 rounded-[22px] p-3 ring-1 ring-black/5">
                  <p className="flex items-center gap-1.5 px-1 text-xs font-bold">
                    <Zap className="size-3.5 fill-current text-ali-orange" /> Today&apos;s flash deals
                  </p>
                  <ProductCarousel items={dealPicks} />
                </div>
              ) : null}
            </div>
          ) : null}
          {messages.map((m, i) => {
            const day = dayLabel(m.time);
            const prevDay = i > 0 ? dayLabel(messages[i - 1].time) : null;
            const divider = day !== prevDay ? <DayDivider key={`day-${i}`} label={day} /> : null;
            if (m.role === "user") {
              return (
                <div key={m.id ?? `u-${i}`}>
                  {divider}
                  <div
                    className={cn(
                      "ml-auto w-fit max-w-[86%] rounded-[20px] rounded-br-lg bg-neutral-900 px-4 py-2.5 text-sm leading-6 text-white shadow-sm",
                      m.fresh && "ai-msg-in"
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              );
            }
            const { body, verdict } = m.compare ? splitVerdict(m.content) : { body: m.content, verdict: undefined };
            const showFollowups = i === lastAssistantIdx && !busy && suggestions.length > 0;
            return (
              <div key={m.id ?? `a-${i}`}>
                {divider}
                <div className={cn("group/answer space-y-2", m.fresh && "ai-msg-in")}>
                  <div className="flex items-center gap-1.5">
                    <AssistantAvatar />
                    <span className="text-[12px] font-bold text-neutral-800">{aiName}</span>
                  </div>
                  <div className="ai-card rounded-[20px] rounded-tl-lg px-4 py-3 text-[14.5px] leading-7 text-neutral-800 ring-1 ring-black/5">
                    <AssistantText text={body} titles={titles} />
                  </div>
                  <div className="flex items-center gap-2 pl-1">
                    <time className="text-[10px] text-neutral-400">
                      {new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </time>
                    {m.id ? (
                      <span className="transition md:opacity-0 md:group-hover/answer:opacity-100 md:focus-within:opacity-100">
                        <FeedbackRow messageId={m.id} value={m.feedback} onVote={vote} />
                      </span>
                    ) : null}
                  </div>
                  {m.citations && m.citations.length > 0 ? (
                    m.compare ? (
                      <CompareTable items={m.citations} verdict={verdict} />
                    ) : (
                      <ProductCarousel items={m.citations} stagger={m.fresh} />
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
              </div>
            );
          })}
          {busy ? (
            <div className="ai-msg-in space-y-2" aria-label="Assistant is thinking">
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                <AssistantAvatar />
                <span className="font-semibold text-neutral-700">{aiName}</span>
              </div>
              <div className="ai-card w-fit rounded-[20px] rounded-tl-lg px-3 ring-1 ring-black/5">
                <TypingDots />
              </div>
              <div className="flex gap-2.5">
                {[0, 1].map((k) => (
                  <div key={k} className="ai-card w-[216px] shrink-0 overflow-hidden rounded-[20px] ring-1 ring-black/5">
                    <div className="ai-shimmer flex aspect-[5/4] items-center justify-center bg-neutral-200/60">
                      <ImageIcon className="size-8 text-neutral-400" />
                    </div>
                    <div className="animate-pulse space-y-1.5 p-3">
                      <div className="h-2.5 w-full rounded bg-neutral-200/80" />
                      <div className="h-4 w-1/2 rounded bg-neutral-200/80" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {notice ? (
            <p className="ai-msg-in flex items-start gap-1.5 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-xs leading-5 text-amber-800 ring-1 ring-amber-200/60">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> <span>{notice}</span>
            </p>
          ) : null}
        </div>
        {showLatest ? (
          <button
            onClick={jumpToLatest}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-neutral-900/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur transition hover:bg-neutral-900 active:scale-95"
          >
            <ArrowDown className="size-3.5" /> Latest
          </button>
        ) : null}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t bg-white/95 p-3 backdrop-blur"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about products, deals, orders…"
          aria-label={`Ask ${aiName}`}
          className="h-11 flex-1 rounded-full border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none transition placeholder:text-neutral-400 focus:border-ali-red/50 focus:bg-white focus:ring-4 focus:ring-ali-red/10"
          maxLength={2000}
        />
        <Button
          type="submit"
          size="icon"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="size-11 shrink-0 rounded-full bg-ali-red text-white shadow-sm transition hover:bg-ali-red-dark active:scale-90 disabled:opacity-40"
        >
          <Send className="size-4" />
        </Button>
      </form>
      <p className="border-t bg-white px-4 py-1.5 text-[10px] text-neutral-400">AI can make mistakes — the product page is authoritative.</p>
    </div>
  );
}

function DrawerHeader({ name, onClose, onNewChat }: { name: string; onClose: () => void; onNewChat?: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-neutral-100 bg-white/95 px-4 py-3 backdrop-blur">
      <AssistantAvatar size="size-8" icon="size-4" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-bold">{name}</p>
        <p className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
          <span className="size-1.5 rounded-full bg-emerald-500" /> Online
        </p>
      </div>
      {onNewChat ? (
        <Button variant="ghost" size="icon-sm" onClick={onNewChat} aria-label="Start new chat" title="Start new chat" className="rounded-full">
          <Plus />
        </Button>
      ) : null}
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close assistant" className="rounded-full">
        <X />
      </Button>
    </div>
  );
}
