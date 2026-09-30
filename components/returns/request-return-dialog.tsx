"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatUSD } from "@/lib/format";
import type { OrderItem, ShipmentView } from "@/lib/refine/types";

export const RETURN_REASON_OPTIONS = [
  { value: "NOT_AS_DESCRIBED", label: "Not as described" },
  { value: "DEFECTIVE", label: "Defective" },
  { value: "WRONG_ITEM", label: "Wrong item" },
  { value: "NO_LONGER_NEEDED", label: "No longer needed" },
  { value: "BETTER_PRICE_ELSEWHERE", label: "Found a better price" },
  { value: "DAMAGED_IN_TRANSIT", label: "Damaged in transit" },
  { value: "OTHER", label: "Other" },
] as const;

/**
 * Buyer opens a return.
 *
 * Separate from the dispute dialog on purpose: "I want my money back" is not an
 * accusation and should not freeze the seller's escrow as a dispute does. A
 * return is also per-seller, so the picker is scoped to one seller at a time.
 */
export function RequestReturnDialog({
  orderNumber,
  items,
  shipments = [],
}: {
  orderNumber: string;
  items: OrderItem[];
  shipments?: ShipmentView[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("NOT_AS_DESCRIBED");
  const [note, setNote] = useState("");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Parcel === seller, so the picker is naturally scoped one seller at a time.
  const storeName = useMemo(
    () => new Map(shipments.filter((s) => s.store).map((s) => [s.storeId, s.store!.name])),
    [shipments]
  );

  const groups = useMemo(() => {
    const byKey = new Map<string, OrderItem[]>();
    for (const i of items) {
      const key = i.storeId ?? "__all";
      byKey.set(key, [...(byKey.get(key) ?? []), i]);
    }
    return [...byKey.entries()];
  }, [items]);

  const activeStore = storeId ?? groups[0]?.[0] ?? "__all";
  const visible = groups.find(([k]) => k === activeStore)?.[1] ?? [];
  const selected = visible.filter((i) => picked[i.id]);
  const total = selected.reduce((a, i) => a + i.price, 0);

  const submit = async () => {
    if (selected.length === 0) {
      toast.error("Select at least one item to return.");
      return;
    }
    if (note.trim().length < 5) {
      toast.error("Add a short note so the seller knows what to expect.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/account/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber,
          reason,
          note: note.trim(),
          lines: selected.map((i) => ({ orderItemId: i.id, qty: 1 })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Couldn't open the return.");
      toast.success("Return requested. The seller has been notified.");
      setOpen(false);
      setPicked({});
      setNote("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open the return.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <RotateCcw className="size-4" /> Request return
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request a return</DialogTitle>
          <DialogDescription>
            Changed your mind, or the item isn&apos;t right? A return is not a dispute — it won&apos;t
            count against the seller&apos;s dispute record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {groups.length > 1 && groups[0][0] !== "__all" ? (
            <div>
              <label htmlFor="ret-store" className="text-xs font-semibold text-neutral-600">
                Seller
              </label>
              <Select value={activeStore} onValueChange={setStoreId}>
                <SelectTrigger id="ret-store">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(([key, list]) => (
                    <SelectItem key={key} value={key}>
                      {storeName.get(key) ?? `${list.length} item${list.length === 1 ? "" : "s"}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-neutral-500">
                Each seller processes their own returns separately.
              </p>
            </div>
          ) : null}

          <fieldset>
            <legend className="text-xs font-semibold text-neutral-600">Items</legend>
            <ul className="mt-1.5 space-y-1.5">
              {visible.map((i) => (
                <li key={i.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm">
                    <Checkbox
                      checked={!!picked[i.id]}
                      onCheckedChange={(v) => setPicked((p) => ({ ...p, [i.id]: v === true }))}
                    />
                    <span className="min-w-0 flex-1 truncate">{i.title}</span>
                    <span className="shrink-0 text-xs text-neutral-500">{formatUSD(i.price)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <div>
            <label htmlFor="ret-reason" className="text-xs font-semibold text-neutral-600">
              Reason
            </label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="ret-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETURN_REASON_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="ret-note" className="text-xs font-semibold text-neutral-600">
              Note for the seller
            </label>
            <Textarea
              id="ret-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Why are you returning it? Mention fit, condition, or what arrived."
            />
          </div>

          <p className="rounded-lg bg-neutral-100 p-2 text-xs text-neutral-600 dark:bg-neutral-800">
            Requesting a return holds this seller&apos;s payout for these items until it&apos;s resolved.
            You&apos;re not charged anything extra.
            {selected.length > 0 ? ` Refundable amount: ${formatUSD(total)}.` : ""}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || selected.length === 0} className="bg-ali-red text-white hover:bg-ali-red-dark">
            {saving ? <><Loader2 className="size-4 animate-spin" /> Sending…</> : "Request return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
