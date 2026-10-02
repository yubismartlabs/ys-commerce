"use client";

import Link from "next/link";
import { useState } from "react";
import { Flag, LifeBuoy, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MessageButton } from "@/components/chat/message-button";
import { usePublicSettings } from "@/lib/public-settings";
import { PRODUCT_REPORT_REASONS, type ProductReportReason } from "@/lib/products/report-reasons";
import { storeUrl } from "@/lib/stores/url";
import { cn } from "@/lib/utils";

export type WatchActionProduct = {
  slug: string;
  title: string;
  category: string;
  store: { id: string; name: string; slug: string; username?: string | null };
};

const linkCls =
  "inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white";

/**
 * Per-row actions on a watched item: the things a buyer wants without leaving
 * the list. Similar items and the seller's shelf are plain links; contacting
 * the seller reuses the chat open flow; help and report are dialogs because
 * both need a sentence of context before the buyer commits.
 */
export function WatchRowActions({ item, base }: { item: WatchActionProduct; base: string }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      <Link href={`/search?category=${encodeURIComponent(item.category)}`} className={linkCls}>
        Similar items
      </Link>
      <Link href={storeUrl(item.store)} className={linkCls}>
        <Store className="size-3" /> Seller&apos;s other items
      </Link>
      <MessageButton
        productId={item.slug}
        label="Contact seller"
        basePath={`${base}/messages`}
        size="sm"
        variant="ghost"
      />
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogTrigger asChild>
          <button type="button" className={linkCls}>
            <LifeBuoy className="size-3" /> Help
          </button>
        </DialogTrigger>
        <HelpBody
          title={item.title}
          onContact={() => setHelpOpen(false)}
          onReport={() => {
            setHelpOpen(false);
            setReportOpen(true);
          }}
          base={base}
          slug={item.slug}
        />
      </Dialog>
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(linkCls, reported && "pointer-events-none text-neutral-300 dark:text-neutral-600")}
            aria-disabled={reported}
          >
            <Flag className="size-3" /> {reported ? "Reported" : "Report"}
          </button>
        </DialogTrigger>
        <ReportBody
          title={item.title}
          slug={item.slug}
          onDone={() => {
            setReported(true);
            setReportOpen(false);
          }}
        />
      </Dialog>
    </div>
  );
}

function HelpBody({
  title,
  base,
  slug,
  onContact,
  onReport,
}: {
  title: string;
  base: string;
  slug: string;
  onContact: () => void;
  onReport: () => void;
}) {
  const { buyerProtectionText, buyerProtectionDays } = usePublicSettings();
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Need help with this item?</DialogTitle>
        <DialogDescription className="line-clamp-2">{title}</DialogDescription>
      </DialogHeader>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        {buyerProtectionText} Protection covers you for {buyerProtectionDays} days after delivery.
      </p>
      <div className="flex flex-wrap gap-2">
        <span onClick={onContact}>
          <MessageButton productId={slug} label="Message the seller" basePath={`${base}/messages`} size="sm" />
        </span>
        <Button size="sm" variant="outline" onClick={onReport}>
          <Flag className="size-4" /> Report this item
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href={`${base}/disputes`}>My disputes</Link>
        </Button>
      </div>
    </DialogContent>
  );
}

function ReportBody({ title, slug, onDone }: { title: string; slug: string; onDone: () => void }) {
  const [reason, setReason] = useState<ProductReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/products/${encodeURIComponent(slug)}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, ...(detail.trim() ? { detail: detail.trim() } : {}) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Report failed.");
      toast.success("Thanks — trust & safety will take a look.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Report failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Report this item</DialogTitle>
        <DialogDescription className="line-clamp-2">{title}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5" role="radiogroup" aria-label="Report reason">
        {PRODUCT_REPORT_REASONS.map((r) => {
          const active = reason === r.value;
          return (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setReason(r.value)}
              className={cn(
                "flex items-baseline gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
                active
                  ? "border-neutral-900 bg-neutral-50 dark:border-white dark:bg-neutral-800"
                  : "border-neutral-200 dark:border-neutral-700"
              )}
            >
              <span className="font-semibold">{r.label}</span>
              <span className="text-xs text-neutral-500">{r.hint}</span>
            </button>
          );
        })}
      </div>
      <Textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Anything we should know? (optional, 500 chars)"
        maxLength={500}
        rows={2}
        aria-label="Report details"
      />
      <DialogFooter>
        <Button size="sm" disabled={!reason || busy} onClick={submit}>
          {busy ? "Sending…" : "Send report"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
