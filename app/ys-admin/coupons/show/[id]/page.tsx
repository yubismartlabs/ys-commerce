"use client";

import { use } from "react";
import { useShow, useDelete } from "@refinedev/core";
import { useRouter } from "next/navigation";
import { Percent, Ticket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BackLink, ErrorState, Field, SectionTitle, StatusBadge, TableSkeleton } from "@/components/refine/ui";
import { timeAgo } from "@/lib/format";
import type { Coupon } from "@/lib/refine/types";

export default function CouponShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { query } = useShow<Coupon>({ resource: "coupons", id });
  const { mutate, mutation } = useDelete();
  const router = useRouter();
  const c = query.data?.data;

  if (query.isLoading) return (<><BackLink href="/ys-admin/coupons" label="Coupons" /><Card className="p-0"><TableSkeleton rows={4} cols={2} /></Card></>);
  if (query.isError || !c) return (<><BackLink href="/ys-admin/coupons" label="Coupons" /><Card className="p-0"><ErrorState message="Coupon not found." /></Card></>);

  return (
    <div className="space-y-4">
      <BackLink href="/ys-admin/coupons" label="Coupons" />
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 px-4 py-2 font-mono text-xl font-black tracking-widest dark:border-neutral-700">
            <Ticket className="size-5 text-ali-red" /> {c.code}
          </span>
          <StatusBadge value={c.active ? "ACTIVE" : "INACTIVE"} />
        </div>
        <Separator className="my-5" />
        <SectionTitle>Details</SectionTitle>
        <dl className="mt-3 space-y-2.5">
          <Field label="Discount">
            <span className="inline-flex items-center gap-1.5 font-semibold"><Percent className="size-3.5 text-neutral-400" />{c.pctOff}% off</span>
          </Field>
          <Field label="Created">{timeAgo(c.createdAt)}</Field>
        </dl>
        <div className="pt-4">
          <Button
            size="sm"
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => {
              if (!window.confirm(`Delete coupon ${c.code}?`)) return;
              mutate({ resource: "coupons", id }, { onSuccess: () => router.push("/ys-admin/coupons") });
            }}
          >
            Delete coupon
          </Button>
        </div>
      </Card>
    </div>
  );
}
