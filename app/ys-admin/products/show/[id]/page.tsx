"use client";

import { use, useState } from "react";
import { useShow, useUpdate } from "@refinedev/core";
import Image from "next/image";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BackLink, ErrorState, Field, SectionTitle, StatusBadge, TableSkeleton } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";
import type { Product } from "@/lib/refine/types";

/**
 * Dismiss one buyer report. Plain fetch rather than a refine resource: there
 * is no reports collection screen, and adding a resource for a single button
 * would drag the generic data-provider's list/update/delete machinery along.
 */
function ReportDismissButton({ id, onDismissed }: { id: string; onDismissed: () => void }) {
  const [busy, setBusy] = useState(false);
  const dismiss = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/product-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DISMISSED" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Dismiss failed.");
      toast.success("Report dismissed.");
      onDismissed();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dismiss failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={dismiss} className="shrink-0">
      Dismiss
    </Button>
  );
}

export default function ProductShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { query } = useShow<Product>({ resource: "products", id });
  const { mutate, mutation } = useUpdate();
  const p = query.data?.data;

  if (query.isLoading) return (<><BackLink href="/ys-admin/products" label="Products" /><Card className="p-0"><TableSkeleton rows={5} cols={2} /></Card></>);
  if (query.isError || !p) return (<><BackLink href="/ys-admin/products" label="Products" /><Card className="p-0"><ErrorState message="Product not found." /></Card></>);

  return (
    <div className="space-y-4">
      <BackLink href="/ys-admin/products" label="Products" />
      <Card className="p-6">
        <div className="flex flex-wrap gap-5">
          <div className="relative aspect-square w-36 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
            <Image src={p.image} alt={p.title} fill sizes="144px" className="object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold leading-snug">{p.title}</h1>
              <StatusBadge value={p.status} />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-black text-ali-red">{formatUSD(p.price)}</span>
              {p.compareAt ? <span className="text-sm text-neutral-400 line-through">{formatUSD(p.compareAt)}</span> : null}
            </div>
            <p className="mt-1 text-sm text-neutral-500">{p.store.name} · {p.category}{p.freeShipping ? " · Free shipping" : ""}{p.badge ? ` · ${p.badge}` : ""}</p>
            <p className="mt-1 text-sm text-neutral-500">
              ★ {p.ratingAvg.toFixed(1)} ({p.ratingCount} reviews) · {p.soldCount} sold
            </p>
            <div className="mt-3">
              {p.status === "ACTIVE" ? (
                <Button size="sm" variant="destructive" disabled={mutation.isPending} onClick={() => mutate({ resource: "products", id, values: { status: "TAKEDOWN" } })}>Takedown listing</Button>
              ) : (
                <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutate({ resource: "products", id, values: { status: "ACTIVE" } })}>Restore listing</Button>
              )}
            </div>
          </div>
        </div>

        {p.description ? (<><Separator className="my-5" /><SectionTitle>Description</SectionTitle><p className="mt-2 text-sm text-neutral-600">{p.description}</p></>) : null}

        {p.images && p.images.length > 0 ? (
          <>
            <Separator className="my-5" />
            <SectionTitle>Gallery ({p.images.length})</SectionTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.images.map((g) => (
                <span key={g} className="relative size-20 overflow-hidden rounded-lg bg-neutral-100">
                  <Image src={g} alt="" fill sizes="80px" className="object-cover" />
                </span>
              ))}
            </div>
          </>
        ) : null}

        {p.specs && p.specs.length > 0 ? (
          <>
            <Separator className="my-5" />
            <SectionTitle>Specifications</SectionTitle>
            <dl className="mt-2 divide-y text-sm">
              {p.specs.map((s) => (
                <div key={s.k} className="grid grid-cols-[160px_1fr] gap-2 py-1.5">
                  <dt className="text-neutral-500">{s.k}</dt>
                  <dd>{s.v}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}

        {p.variants && p.variants.length > 0 && (
          <>
            <Separator className="my-5" />
            <SectionTitle>Variants ({p.variants.length})</SectionTitle>
            <Table className="mt-2">
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>SKU</TableHead><TableHead>Price</TableHead><TableHead className="text-right">Stock</TableHead></TableRow></TableHeader>
              <TableBody>
                {p.variants.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell className="font-mono text-xs text-neutral-500">{v.sku ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{v.price != null ? formatUSD(v.price) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{v.stock}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}

        <Separator className="my-5" />
        <SectionTitle>
          Buyer reports ({p.reports?.length ?? 0})
        </SectionTitle>
        {(p.reports?.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No open reports on this listing.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {p.reports!.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {r.reason.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                    <span className="ml-2 font-normal text-neutral-500">{r.reporter.email} · {timeAgo(r.createdAt)}</span>
                  </p>
                  {r.detail ? <p className="mt-0.5 text-neutral-600 dark:text-neutral-300">{r.detail}</p> : null}
                </div>
                <ReportDismissButton id={r.id} onDismissed={() => query.refetch()} />
              </li>
            ))}
          </ul>
        )}

        <Separator className="my-5" />
        <SectionTitle>Record</SectionTitle>
        <dl className="mt-3 space-y-2.5">
          <Field label="Slug"><span className="font-mono text-[13px]">{p.slug}</span></Field>
        </dl>
      </Card>
    </div>
  );
}
