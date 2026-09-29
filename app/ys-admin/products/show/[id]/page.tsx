"use client";

import { use } from "react";
import { useShow, useUpdate } from "@refinedev/core";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BackLink, ErrorState, Field, SectionTitle, StatusBadge, TableSkeleton } from "@/components/refine/ui";
import { formatUSD } from "@/lib/format";
import type { Product } from "@/lib/refine/types";

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
        <SectionTitle>Record</SectionTitle>
        <dl className="mt-3 space-y-2.5">
          <Field label="Slug"><span className="font-mono text-[13px]">{p.slug}</span></Field>
        </dl>
      </Card>
    </div>
  );
}
