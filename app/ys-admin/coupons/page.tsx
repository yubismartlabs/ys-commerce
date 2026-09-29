"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useTable } from "@refinedev/core";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, PageHeader, Pager, StatusBadge, TableSkeleton } from "@/components/refine/ui";
import { timeAgo } from "@/lib/format";
import type { Coupon } from "@/lib/refine/types";

const typeOptions = ["PERCENT", "FIXED", "FREESHIP"] as const;

export function couponValue(c: Coupon): string {
  if (c.type === "FREESHIP") return "Free shipping";
  if (c.type === "FIXED") return `$${Number(c.amountOff ?? 0).toFixed(2)} off`;
  return `−${c.pctOff ?? 0}%`;
}

function rules(c: Coupon): string {
  const parts: string[] = [];
  if (c.minSubtotal) parts.push(`min $${Number(c.minSubtotal).toFixed(2)}`);
  if (c.maxUses) parts.push(`${c.usedCount}/${c.maxUses} used`);
  else if (c.usedCount) parts.push(`${c.usedCount} used`);
  if (c.perUserLimit) parts.push(`max ${c.perUserLimit}/user`);
  if (c.categories.length > 0) parts.push(c.categories.join(","));
  if (c.endsAt) parts.push(`ends ${new Date(c.endsAt).toLocaleDateString()}`);
  return parts.join(" · ") || "—";
}

export default function CouponsPage() {
  const [active, setActive] = useState<string | undefined>(undefined);
  const [type, setType] = useState<string | undefined>(undefined);
  const [q, setQ] = useState("");
  const { tableQuery, filters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<Coupon>({
      resource: "coupons",
      pagination: { pageSize: 20, mode: "server" },
      syncWithLocation: true,
    });

  const rows = tableQuery.data?.data ?? [];
  const total = tableQuery.data?.total;
  void filters;

  const apply = (a = active, t = type, query = q) => {
    const next: Array<{ field: string; operator: "eq"; value: string }> = [];
    if (a !== undefined) next.push({ field: "active", operator: "eq", value: a });
    if (t !== undefined) next.push({ field: "type", operator: "eq", value: t });
    if (query.trim()) next.push({ field: "q", operator: "eq", value: query.trim() });
    setFilters(next);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Coupons"
        description="Percent, fixed-amount and free-shipping codes with usage rules."
        actions={
          <Button asChild className="bg-ali-red text-white hover:bg-ali-red-dark">
            <Link href="/ys-admin/coupons/create"><Plus className="size-4" /> New coupon</Link>
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {(["ALL", "ACTIVE", "INACTIVE"] as const).map((s) => {
          const v = s === "ALL" ? undefined : s === "ACTIVE" ? "1" : "0";
          return (
            <Button
              key={s}
              size="sm"
              variant={active === v ? "default" : "outline"}
              className="rounded-full"
              onClick={() => { setActive(v); apply(v, type, q); }}
            >
              {s}
            </Button>
          );
        })}
        <span className="mx-1 text-neutral-300">|</span>
        {typeOptions.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={type === t ? "default" : "outline"}
            className="rounded-full font-mono text-xs"
            onClick={() => { const v = type === t ? undefined : t; setType(v); apply(active, v, q); }}
          >
            {t}
          </Button>
        ))}
        <form
          className="ml-auto flex gap-2"
          onSubmit={(e) => { e.preventDefault(); apply(active, type, q); }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code…" className="w-44 uppercase" />
          <Button type="submit" size="sm" variant="outline">Search</Button>
        </form>
      </div>
      <Card className="overflow-hidden p-0">
        {tableQuery.isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : tableQuery.isError ? (
          <ErrorState message="Failed to load coupons. Check the API connection and retry." />
        ) : rows.length === 0 ? (
          <EmptyState title="No coupons found" hint="Create one or clear the filters." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>Value</TableHead><TableHead>Rules</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Action</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <TableCell>
                    <Link href={`/ys-admin/coupons/show/${c.id}`} className="rounded-md bg-neutral-100 px-2 py-1 font-mono text-[13px] font-bold underline-offset-2 hover:underline dark:bg-neutral-800">
                      {c.code}
                    </Link>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="font-mono text-[10px]">{c.type}</Badge></TableCell>
                  <TableCell className="font-semibold tabular-nums">{couponValue(c)}</TableCell>
                  <TableCell className="max-w-64 truncate text-xs text-neutral-500">{rules(c)}</TableCell>
                  <TableCell><StatusBadge value={c.active ? "ACTIVE" : "INACTIVE"} /></TableCell>
                  <TableCell className="whitespace-nowrap text-neutral-500">{timeAgo(c.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/ys-admin/coupons/show/${c.id}`}>Open</Link>
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
