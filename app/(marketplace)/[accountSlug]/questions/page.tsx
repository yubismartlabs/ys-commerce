"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, MessageCircleQuestion, Store } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/refine/ui";
import { readData } from "@/lib/api/client";
import { timeAgo } from "@/lib/format";

type Row = {
  id: string;
  body: string;
  hidden: boolean;
  createdAt: string;
  author: { id: string; name: string | null };
  product: { slug: string; title: string };
  answers: Array<{
    id: string;
    body: string;
    fromSeller: boolean;
    createdAt: string;
    author: { id: string; name: string | null } | null;
  }>;
};

/**
 * Seller Q&A queue across all listings.
 *
 * Hiding (not deleting) is the default: the thread is public and other buyers
 * read the answers, so removing a question destroys value other shoppers were
 * relying on. Only the asker may delete their own.
 */
export default function SellerQuestionsPage() {
  const queryClient = useQueryClient();
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const query = useQuery({
    queryKey: ["selling-questions"],
    queryFn: async () => readData<{ questions: Row[]; unanswered: number }>(await fetch("/api/v1/account/selling/questions")),
    retry: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["selling-questions"] });
    setReplyTo(null);
    setReply("");
  };

  const answer = useMutation({
    mutationFn: async (id: string) => {
      await readData(
        await fetch(`/api/v1/account/selling/questions/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: reply }),
        })
      );
    },
    onSuccess: () => {
      toast.success("Answer posted — it's public on the product page.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't post."),
  });

  const setHidden = async (id: string, hidden: boolean) => {
    try {
      await readData(
        await fetch(`/api/v1/account/selling/questions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hidden }),
        })
      );
      toast.success(hidden ? "Question hidden." : "Question visible again.");
      queryClient.invalidateQueries({ queryKey: ["selling-questions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update.");
    }
  };

  const rows = query.data?.questions ?? [];

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold">Product Q&amp;A</h1>
        <p className="text-sm text-neutral-500">
          Questions buyers ask about your listings. Answering publicly helps every future visitor — and
          answering quickly is one of the strongest trust signals on a marketplace.
        </p>
      </div>

      {query.isLoading ? (
        <Card className="p-6 text-sm text-neutral-500">Loading questions…</Card>
      ) : query.isError ? (
        <Card className="p-0"><ErrorState message={query.error instanceof Error ? query.error.message : "Couldn't load questions."} /></Card>
      ) : rows.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={MessageCircleQuestion}
            title="No questions yet"
            hint="Buyers ask questions on your product pages once your listings get traffic."
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((q) => (
            <li key={q.id}>
              <Card className={`p-4 ${q.hidden ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  {q.hidden ? (
                    <Badge variant="secondary" className="text-[10px]">HIDDEN</Badge>
                  ) : q.answers.length === 0 ? (
                    <Badge className="bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400">UNANSWERED</Badge>
                  ) : null}
                  <Link href={`/product/${q.product.slug}`} className="line-clamp-1 text-sm font-bold hover:underline">
                    {q.product.title}
                  </Link>
                  <span className="text-xs text-neutral-500">
                    {q.author.name ?? "Buyer"} · {timeAgo(q.createdAt)}
                  </span>
                </div>

                <p className="mt-1.5 text-sm">{q.body}</p>

                {q.answers.length > 0 ? (
                  <ul className="mt-2 space-y-1.5 border-l-2 pl-3">
                    {q.answers.map((a) => (
                      <li key={a.id}>
                        <p className="text-sm">{a.body}</p>
                        <p className="flex items-center gap-1 text-[11px] text-neutral-500">
                          {a.fromSeller ? (
                            <><Store className="size-3" /><span className="font-semibold text-emerald-700 dark:text-emerald-400">You</span></>
                          ) : (
                            (a.author?.name ?? "Buyer")
                          )}{" "}
                          · {timeAgo(a.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {replyTo === q.id ? (
                    <>
                      <Textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        rows={2}
                        placeholder="Answer publicly on the product page…"
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        disabled={reply.trim().length < 2 || answer.isPending}
                        onClick={() => answer.mutate(q.id)}
                        className="bg-ali-red text-white hover:bg-ali-red-dark"
                      >
                        {answer.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Post
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReply(""); }}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => setReplyTo(q.id)} className="bg-ali-red text-white hover:bg-ali-red-dark">
                      Answer
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setHidden(q.id, !q.hidden)}>
                    {q.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    {q.hidden ? "Unhide" : "Hide"}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
