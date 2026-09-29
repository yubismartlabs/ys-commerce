"use client";

import { use } from "react";
import { useShow, useUpdate } from "@refinedev/core";
import { CalendarDays, Mail, Package, Percent } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { BackLink, ErrorState, Field, SectionTitle, StatusBadge, TableSkeleton } from "@/components/refine/ui";
import { initials, timeAgo } from "@/lib/format";
import type { Vendor } from "@/lib/refine/types";

export default function VendorShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { query } = useShow<Vendor>({ resource: "vendors", id });
  const { mutate, mutation } = useUpdate();
  const v = query.data?.data;

  if (query.isLoading) return (<><BackLink href="/ys-admin/vendors" label="Vendors" /><Card className="p-0"><TableSkeleton rows={5} cols={2} /></Card></>);
  if (query.isError || !v) return (<><BackLink href="/ys-admin/vendors" label="Vendors" /><Card className="p-0"><ErrorState message="Vendor not found." /></Card></>);

  const act = (status: Vendor["status"]) => mutate({ resource: "vendors", id, values: { status } });

  return (
    <div className="space-y-4">
      <BackLink href="/ys-admin/vendors" label="Vendors" />
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-neutral-900 text-lg font-bold text-white dark:bg-white dark:text-neutral-900">
              {initials(v.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{v.name}</h1>
              <StatusBadge value={v.status} />
            </div>
            <p className="mt-0.5 font-mono text-xs text-neutral-400">{v.slug}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {v.status === "PENDING" && (
              <>
                <Button size="sm" disabled={mutation.isPending} className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => act("APPROVED")}>Approve</Button>
                <Button size="sm" variant="destructive" disabled={mutation.isPending} onClick={() => act("REJECTED")}>Reject</Button>
              </>
            )}
            {v.status === "APPROVED" && (
              <Button size="sm" variant="destructive" disabled={mutation.isPending} onClick={() => act("SUSPENDED")}>Suspend</Button>
            )}
            {v.status === "SUSPENDED" && (
              <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => act("APPROVED")}>Reinstate</Button>
            )}
          </div>
        </div>

        <Separator className="my-5" />
        <SectionTitle>Store details</SectionTitle>
        <dl className="mt-3 space-y-2.5">
          <Field label="Owner">
            <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5 text-neutral-400" />{v.owner.name ?? v.owner.email} <span className="text-neutral-400">({v.owner.email})</span></span>
          </Field>
          <Field label="Products">
            <span className="inline-flex items-center gap-1.5"><Package className="size-3.5 text-neutral-400" />{v._count.products} listings</span>
          </Field>
          <Field label="Commission">
            <span className="inline-flex items-center gap-1.5"><Percent className="size-3.5 text-neutral-400" />{Math.round(v.commissionRate * 100)}%</span>
          </Field>
          <Field label="Joined">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5 text-neutral-400" />{timeAgo(v.createdAt)}</span>
          </Field>
          {v.description ? <Field label="About">{v.description}</Field> : null}
        </dl>
      </Card>
    </div>
  );
}
