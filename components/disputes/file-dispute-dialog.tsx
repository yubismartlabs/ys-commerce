"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccountBase } from "@/lib/account-url";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const DISPUTE_CATEGORIES = [
  "NOT_RECEIVED",
  "DAMAGED",
  "WRONG_ITEM",
  "QUALITY",
  "NOT_AS_DESCRIBED",
  "OTHER",
] as const;

/** Buyer files a dispute from their order page. Freezes escrow on open. */
export function FileDisputeDialog({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const base = useAccountBase();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("NOT_RECEIVED");
  const [reason, setReason] = useState("");
  const [filing, setFiling] = useState(false);

  const file = async () => {
    if (reason.trim().length < 10) {
      toast.error("Describe the issue in at least 10 characters.");
      return;
    }
    setFiling(true);
    try {
      const res = await fetch("/api/v1/account/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, category, reason: reason.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Filing failed.");
      toast.success("Dispute opened — the seller's funds are frozen.");
      setOpen(false);
      router.push(`${base}/disputes/${json.data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Filing failed.");
    } finally {
      setFiling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Flag className="size-3.5" /> Report a problem
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a dispute — {orderNumber}</DialogTitle>
          <DialogDescription>
            Filing freezes the seller&apos;s payment in escrow until mediation rules.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DISPUTE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What went wrong? (min 10 characters)" rows={4} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={file} disabled={filing} className="bg-ali-red text-white hover:bg-ali-red-dark">
            {filing ? <Loader2 className="size-4 animate-spin" /> : null} File dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
