"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HelpCircle, Loader2, MessageCircleQuestion, Send, Store } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { readData } from "@/lib/api/client";
import { timeAgo } from "@/lib/format";

type Answer = {
  id: string;
  body: string;
  fromSeller: boolean;
  createdAt: string;
  author: { id: string; name: string | null } | null;
};

type Question = {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  author: { id: string; name: string | null };
  answers: Answer[];
};

/**
 * Public product Q&A.
 *
 * One question per buyer per product, because this is a shared thread every
 * later visitor reads — not a private support ticket. Seller answers are
 * badged so buyers can weight them.
 */
export function ProductQuestions({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const query = useQuery({
    queryKey: ["product-questions", slug],
    queryFn: async (): Promise<{ questions: Question[]; storeName: string }> =>
      readData(await fetch(`/api/v1/products/${slug}/questions?pageSize=50`)),
    staleTime: 60_000,
    retry: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["product-questions", slug] });
    setDraft("");
    setReplyTo(null);
    setReply("");
  };

  const ask = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/products/${slug}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      if (res.status === 401) throw new Error("Sign in to ask a question.");
      return readData(res);
    },
    onSuccess: () => {
      toast.success("Question posted.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't post."),
  });

  const answer = useMutation({
    mutationFn: async (questionId: string) => {
      const res = await fetch(`/api/v1/selling/questions/${questionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      return readData(res);
    },
    onSuccess: () => {
      toast.success("Answer posted.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't post."),
  });

  const remove = async (id: string) => {
    if (!window.confirm("Delete your question and its answers?")) return;
    try {
      await readData(await fetch(`/api/v1/selling/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delete: true }),
      }));
      toast.success("Question deleted.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete.");
    }
  };

  const questions = query.data?.questions ?? [];

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <MessageCircleQuestion className="size-5 text-neutral-500" />
        <h2 className="font-bold">Questions &amp; answers</h2>
        {query.data?.storeName ? (
          <span className="text-xs text-neutral-500">answered by {query.data.storeName}</span>
        ) : null}
        {!query.isLoading ? (
          <Badge variant="secondary" className="ml-auto text-[11px]">
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Public and shared — answers here help everyone considering this product. For anything personal,
        message the seller instead.
      </p>

      <div className="mt-3 space-y-2">
        <label htmlFor={`q-${slug}`} className="text-xs font-semibold text-neutral-600">
          Ask a question
        </label>
        <Textarea
          id={`q-${slug}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Is this really 3.5mm? Does it ship to Canada?"
        />
        <Button
          size="sm"
          disabled={draft.trim().length < 10 || ask.isPending}
          onClick={() => ask.mutate()}
          className="bg-ali-red text-white hover:bg-ali-red-dark"
        >
          {ask.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Post question
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {query.isLoading ? (
          <p className="text-sm text-neutral-500">Loading questions…</p>
        ) : questions.length === 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-neutral-500">
            <HelpCircle className="size-4" /> No questions yet — ask the first one.
          </p>
        ) : (
          questions.map((q) => (
            <article key={q.id} className="rounded-lg border p-3">
              <p className="text-sm">{q.body}</p>
              <p className="mt-1 text-[11px] text-neutral-500">
                {q.author.name ?? "Buyer"} · {timeAgo(q.createdAt)}
                {q.mine ? " · you" : ""}
              </p>

              {q.answers.length > 0 ? (
                <ul className="mt-2 space-y-2 border-l-2 pl-3">
                  {q.answers.map((a) => (
                    <li key={a.id}>
                      <p className="text-sm">{a.body}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-500">
                        {a.fromSeller ? (
                          <>
                            <Store className="size-3" />
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">Seller</span>
                          </>
                        ) : (
                          (a.author?.name ?? "Buyer")
                        )}{" "}
                        · {timeAgo(a.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[11px] italic text-neutral-400">No answer yet.</p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {replyTo === q.id ? (
                  <>
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={2}
                      placeholder="Your answer…"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      disabled={reply.trim().length < 2 || answer.isPending}
                      onClick={() => answer.mutate(q.id)}
                    >
                      {answer.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Post
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReply(""); }}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setReplyTo(q.id)}>
                    Answer
                  </Button>
                )}
                {q.mine ? (
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(q.id)}>
                    Delete
                  </Button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>

      <p className="mt-4 text-[11px] text-neutral-400">
        Selling this product?{" "}
        <Link href="/selling/questions" className="underline">
          Answer questions from your listings
        </Link>
        .
      </p>
    </Card>
  );
}
