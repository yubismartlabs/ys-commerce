"use client";

import { useState } from "react";
import { useTable, useCreate, useUpdate, useDelete } from "@refinedev/core";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, PageHeader, Pager, StatusBadge, StatusFilter, TableSkeleton } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";

const statuses = ["SCHEDULED", "ACTIVE", "ENDED"] as const;

type Deal = {
  id: string;
  dealPrice: number;
  startsAt: string;
  endsAt: string;
  stockCap: number | null;
  soldCount: number;
  status: string;
  createdAt: string;
  product: { slug: string; title: string; price: number; status: string };
};

function toLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DealsPage() {
  const { tableQuery, filters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<Deal>({ resource: "deals", pagination: { pageSize: 20, mode: "server" }, syncWithLocation: true });
  const { mutate: create, mutation: creating } = useCreate();
  const { mutate: update } = useUpdate();
  const { mutate: remove } = useDelete();

  const [slug, setSlug] = useState("");
  const [price, setPrice] = useState("");
  const [cap, setCap] = useState("");
  const now = new Date();
  const [starts, setStarts] = useState(toLocal(now));
  const [ends, setEnds] = useState(toLocal(new Date(now.getTime() + 48 * 3600000)));

  const active = filters.find((f) => "field" in f && f.field === "status") as { value: string } | undefined;
  const rows = tableQuery.data?.data ?? [];
  const total = tableQuery.data?.total;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create(
      {
        resource: "deals",
        values: {
          productSlug: slug.trim(),
          dealPrice: Number(price),
          startsAt: new Date(starts).toISOString(),
          endsAt: new Date(ends).toISOString(),
          ...(cap.trim() ? { stockCap: Number(cap) } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success("Deal scheduled — the scheduler activates it.");
          setSlug("");
          setPrice("");
          setCap("");
        },
        onError: (e) => toast.error((e as { message?: string })?.message ?? "Create failed."),
      }
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Flash deals"
        description="Admin-curated deals. The scheduler starts/ends them and notifies fans."
      />
      <Card className="p-4">
        <form onSubmit={submit} className="grid gap-2 md:grid-cols-6">
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="product slug" required className="font-mono md:col-span-2" />
          <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Deal $" inputMode="decimal" required />
          <Input value={cap} onChange={(e) => setCap(e.target.value)} placeholder="Cap (opt)" inputMode="numeric" />
          <Input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} required title="Starts at" />
          <Input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} required title="Ends at" />
          <Button type="submit" disabled={creating.isPending} className="bg-ali-red text-white hover:bg-ali-red-dark md:col-span-6 lg:col-span-1">
            {creating.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Schedule
          </Button>
        </form>
      </Card>
      <StatusFilter
        options={statuses}
        value={active?.value}
        onChange={(v) => setFilters(v ? [{ field: "status", operator: "eq", value: v }] : [])}
      />
      <Card className="overflow-hidden p-0">
        {tableQuery.isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : tableQuery.isError ? (
          <ErrorState message="Failed to load deals." />
        ) : rows.length === 0 ? (
          <EmptyState title="No deals" hint="Schedule one above — it goes live at start time." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Product</TableHead><TableHead>Deal</TableHead><TableHead>Window</TableHead><TableHead>Cap</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <p className="line-clamp-1 max-w-56 font-medium">{d.product.title}</p>
                    <p className="font-mono text-xs text-neutral-400">{d.product.slug} · was {formatUSD(d.product.price)}</p>
                  </TableCell>
                  <TableCell className="font-extrabold tabular-nums text-ali-red">{formatUSD(d.dealPrice)}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-neutral-500">
                    {timeAgo(d.startsAt)} → {timeAgo(d.endsAt)}
                  </TableCell>
                  <TableCell className="tabular-nums">{d.stockCap ? `${d.soldCount}/${d.stockCap}` : "—"}</TableCell>
                  <TableCell><StatusBadge value={d.status} /></TableCell>
                  <TableCell className="space-x-1.5 whitespace-nowrap text-right">
                    {d.status !== "ENDED" ? (
                      <Button size="sm" variant="outline" onClick={() => update({ resource: "deals", id: d.id, values: { status: "ENDED" } })}>
                        End
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                      onClick={() => {
                        if (!window.confirm("Delete this deal?")) return;
                        remove({ resource: "deals", id: d.id }, { onError: (e) => toast.error((e as { message?: string })?.message ?? "Delete failed.") });
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Pager page={currentPage} pageCount={pageCount} total={total} onPage={setCurrentPage} />
    </div>
  );
}
