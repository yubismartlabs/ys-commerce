"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, Pager } from "@/components/refine/ui";
import { describeCoupon } from "@/lib/coupons/engine-labels";
import { formatUSD, timeAgo } from "@/lib/format";

const PAGE_SIZE = 20;

type SellerCoupon = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED" | "FREESHIP";
  pctOff: number | null;
  amountOff: number | null;
  minSubtotal: number | null;
  maxUses: number | null;
  perUserLimit: number | null;
  usedCount: number;
  active: boolean;
  endsAt: string | null;
  categories: string[];
  storeNames: string[];
  createdAt: string;
  _count: { redemptions: number };
};

/**
 * Seller coupon management. Codes are always scoped to the seller's own
 * stores, so a coupon can never discount someone else's stock.
 */
export function SellerCoupons() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: ["account-store-coupons", page],
    queryFn: async (): Promise<{ rows: SellerCoupon[]; total: number }> => {
      const res = await fetch(`/api/v1/account/selling/coupons?page=${page}&pageSize=${PAGE_SIZE}`);
      const json = await res.json().catch(() => null);
      if (res.status === 401) throw new Error("Sign in to manage store coupons.");
      if (!res.ok) throw new Error(json?.error?.message ?? "Couldn't load coupons.");
      return { rows: json.data ?? [], total: json.pagination?.total ?? 0 };
    },
    retry: false,
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["account-store-coupons"] });

  const toggle = async (c: SellerCoupon) => {
    try {
      const res = await fetch(`/api/v1/account/selling/coupons/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !c.active }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Update failed.");
      toast.success(c.active ? `${c.code} paused.` : `${c.code} is live.`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed.");
    }
  };

  const remove = async (c: SellerCoupon) => {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    try {
      const res = await fetch(`/api/v1/account/selling/coupons/${c.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Delete failed.");
      toast.success(`${c.code} deleted.`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-neutral-500">
            Discount codes buyers apply at checkout. They only ever discount your own store.
          </p>
        </div>
        <Button onClick={() => setCreating((v) => !v)} className="bg-ali-red text-white hover:bg-ali-red-dark">
          {creating ? <Loader2 className="size-4" /> : <Plus className="size-4" />}
          {creating ? "Cancel" : "New coupon"}
        </Button>
      </div>

      {creating ? (
        <CreateCouponForm
          onDone={() => {
            setCreating(false);
            setPage(1);
            invalidate();
          }}
        />
      ) : null}

      {query.isLoading ? (
        <Card className="p-6 text-sm text-neutral-500">Loading coupons…</Card>
      ) : query.isError ? (
        <Card className="p-0">
          <ErrorState message={query.error instanceof Error ? query.error.message : "Couldn't load coupons."} />
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={Ticket}
            title="No coupons yet"
            hint="Promo codes are one of the cheapest conversion levers you have."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Applies to</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const usedUp = c.maxUses !== null && c.usedCount >= c.maxUses;
                const expired = !!c.endsAt && new Date(c.endsAt) < new Date();
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="font-mono font-bold">{c.code}</span>
                      <p className="text-[11px] text-neutral-500">{timeAgo(c.createdAt)}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {describeCoupon(c)}
                      {c.minSubtotal ? (
                        <p className="text-[11px] text-neutral-500">min {formatUSD(c.minSubtotal)}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-xs text-neutral-600">
                      {c.categories.length > 0 ? c.categories.join(", ") : "All products"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {c.usedCount}
                      {c.maxUses ? ` / ${c.maxUses}` : ""}
                    </TableCell>
                    <TableCell>
                      {usedUp || expired ? (
                        <Badge variant="secondary" className="text-[10px]">{usedUp ? "USED UP" : "EXPIRED"}</Badge>
                      ) : c.active ? (
                        <Badge className="bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-400">LIVE</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">PAUSED</Badge>
                      )}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button size="sm" variant="outline" onClick={() => toggle(c)}>
                        {c.active ? "Pause" : "Activate"}
                      </Button>
                      {c._count.redemptions === 0 ? (
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(c)}>
                          Delete
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      {pages > 1 ? <Pager page={page} pageCount={pages} total={total} onPage={setPage} /> : null}
    </div>
  );
}

function CreateCouponForm({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED" | "FREESHIP">("PERCENT");
  const [pctOff, setPctOff] = useState("10");
  const [amountOff, setAmountOff] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [perUserLimit, setPerUserLimit] = useState("");
  const [categoriesText, setCategoriesText] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/v1/account/selling/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          type,
          ...(type === "PERCENT" ? { pctOff: Number(pctOff) } : {}),
          ...(type === "FIXED" ? { amountOff: Number(amountOff) } : {}),
          ...(minSubtotal ? { minSubtotal: Number(minSubtotal) } : {}),
          ...(maxUses ? { maxUses: Number(maxUses) } : {}),
          ...(perUserLimit ? { perUserLimit: Number(perUserLimit) } : {}),
          ...(categoriesText
            ? { categories: categoriesText.split(",").map((c) => c.trim()).filter(Boolean) }
            : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Couldn't create coupon.");
      toast.success(`Coupon ${json.data.code} created.`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create coupon.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="cp-code" className="text-sm font-medium">Code</label>
          <Input
            id="cp-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SUMMER20"
            required
            minLength={3}
            className="mt-1 font-mono uppercase"
          />
        </div>
        <div>
          <label htmlFor="cp-type" className="text-sm font-medium">Type</label>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger id="cp-type" className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PERCENT">% off items</SelectItem>
              <SelectItem value="FIXED">$ off order</SelectItem>
              <SelectItem value="FREESHIP">Free shipping</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1 text-[11px] text-neutral-500">
            Free shipping waives only your parcel&apos;s shipping, not other sellers&apos;.
          </p>
        </div>

        {type === "PERCENT" ? (
          <div>
            <label htmlFor="cp-pct" className="text-sm font-medium">Percent off</label>
            <Input id="cp-pct" type="number" min={1} max={90} value={pctOff}
              onChange={(e) => setPctOff(e.target.value)} className="mt-1" required />
          </div>
        ) : null}
        {type === "FIXED" ? (
          <div>
            <label htmlFor="cp-amt" className="text-sm font-medium">Amount off (USD)</label>
            <Input id="cp-amt" type="number" min={0.01} step="0.01" value={amountOff}
              onChange={(e) => setAmountOff(e.target.value)} className="mt-1" required />
          </div>
        ) : null}

        <div>
          <label htmlFor="cp-min" className="text-sm font-medium">Minimum spend (optional)</label>
          <Input id="cp-min" type="number" min={0} step="0.01" value={minSubtotal}
            onChange={(e) => setMinSubtotal(e.target.value)} className="mt-1" />
        </div>
        <div>
          <label htmlFor="cp-cats" className="text-sm font-medium">Limit to categories (optional)</label>
          <Textarea
            id="cp-cats"
            value={categoriesText}
            onChange={(e) => setCategoriesText(e.target.value)}
            placeholder="electronics, phones"
            rows={1}
            className="mt-1"
          />
          <p className="mt-1 text-[11px] text-neutral-500">Comma-separated slugs. Blank = all your products.</p>
        </div>
        <div>
          <label htmlFor="cp-max" className="text-sm font-medium">Total uses (optional)</label>
          <Input id="cp-max" type="number" min={1} value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)} className="mt-1" />
        </div>
        <div>
          <label htmlFor="cp-per" className="text-sm font-medium">Uses per customer (optional)</label>
          <Input id="cp-per" type="number" min={1} value={perUserLimit}
            onChange={(e) => setPerUserLimit(e.target.value)} className="mt-1" />
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy} className="bg-ali-red text-white hover:bg-ali-red-dark">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create coupon
          </Button>
        </div>
      </form>
    </Card>
  );
}
