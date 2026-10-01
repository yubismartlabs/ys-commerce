"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";

type Balance = { held: number; frozen: number; pendingPayout: number; paidLifetime: number };
type StoreBalance = { id: string; name: string } & Balance;
type PayoutRow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  store: { name: string };
};

type PayoutsData = {
  stores: StoreBalance[];
  balance: Balance | null;
  payouts: PayoutRow[];
};

async function fetchPayouts(): Promise<PayoutsData> {
  const res = await fetch("/api/v1/account/selling/payouts");
  if (res.status === 401) throw new Error("Sign in to view payouts.");
  if (!res.ok) throw new Error("Couldn't load payouts.");
  return (await res.json()).data as PayoutsData;
}

function Money({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-xl font-extrabold tabular-nums">{formatUSD(value)}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-neutral-400">{hint}</p> : null}
    </Card>
  );
}

export default function SellingPayoutsPage() {
  const query = useQuery({ queryKey: ["account-payouts"], queryFn: fetchPayouts, retry: false });
  const d = query.data;

  if (query.isLoading) return <Card className="p-6 text-sm text-neutral-500">Loading payouts…</Card>;
  if (query.isError) return <Card className="p-6 text-sm text-neutral-500">{query.error.message}</Card>;
  if (!d || !d.balance) return <Card className="p-6 text-sm text-neutral-500">Open a store to earn payouts.</Card>;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Payouts</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Money label="Held in escrow" value={d.balance.held} hint="Releases after buyer protection" />
        <Money label="Frozen (disputes)" value={d.balance.frozen} />
        <Money label="Pending payout" value={d.balance.pendingPayout} hint="Auto-paid above the minimum" />
        <Money label="Paid lifetime" value={d.balance.paidLifetime} />
      </div>
      {d.stores.length > 1 ? (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Store</TableHead><TableHead>Held</TableHead><TableHead>Frozen</TableHead><TableHead>Pending</TableHead><TableHead>Paid</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {d.stores.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="tabular-nums">{formatUSD(s.held)}</TableCell>
                  <TableCell className="tabular-nums">{formatUSD(s.frozen)}</TableCell>
                  <TableCell className="tabular-nums">{formatUSD(s.pendingPayout)}</TableCell>
                  <TableCell className="tabular-nums">{formatUSD(s.paidLifetime)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}
      <h2 className="pt-1 text-sm font-bold uppercase tracking-wide text-neutral-500">Payout history</h2>
      <Card className="overflow-hidden p-0">
        {d.payouts.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">No payouts yet — released escrow accrues here.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Store</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Paid</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {d.payouts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.store.name}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatUSD(p.amount)}</TableCell>
                  <TableCell><StatusBadge value={p.status} /></TableCell>
                  <TableCell className="whitespace-nowrap text-neutral-500">{p.paidAt ? timeAgo(p.paidAt) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
