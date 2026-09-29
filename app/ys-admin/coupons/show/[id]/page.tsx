"use client";

import { use } from "react";
import { useShow, useUpdate, useDelete } from "@refinedev/core";
import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BackLink, ErrorState, Field, SectionTitle, StatusBadge, TableSkeleton } from "@/components/refine/ui";
import { toast } from "sonner";
import { timeAgo, formatUSD } from "@/lib/format";
import { CouponForm, toLocal } from "@/components/coupons/coupon-form";
import { couponValue } from "@/app/ys-admin/coupons/page";
import type { Coupon } from "@/lib/refine/types";

export default function CouponShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { query } = useShow<Coupon>({ resource: "coupons", id });
  const { mutate: save, mutation: saving } = useUpdate();
  const { mutate: remove, mutation: deleting } = useDelete();
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
          <span className="text-lg font-bold">{couponValue(c)}</span>
        </div>
        <Separator className="my-5" />
        <SectionTitle>Usage</SectionTitle>
        <dl className="mt-3 space-y-2.5">
          <Field label="Redeemed">
            {c.usedCount}{c.maxUses ? ` of ${c.maxUses}` : " (unlimited)"}
          </Field>
          <Field label="Created">{timeAgo(c.createdAt)}</Field>
        </dl>
        {c.redemptions && c.redemptions.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow><TableHead>User</TableHead><TableHead>Order</TableHead><TableHead>Discount</TableHead><TableHead>When</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {c.redemptions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-40 truncate font-mono text-xs">{r.userId}</TableCell>
                    <TableCell className="max-w-40 truncate font-mono text-xs">{r.orderId ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{formatUSD(Number(r.amount))}</TableCell>
                    <TableCell className="whitespace-nowrap text-neutral-500">{timeAgo(r.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">No redemptions yet.</p>
        )}
      </Card>

      <SectionTitle>Edit rules</SectionTitle>
      <CouponForm
        defaults={{
          type: c.type,
          pctOff: c.pctOff ?? undefined,
          amountOff: c.amountOff === null ? undefined : Number(c.amountOff),
          active: c.active,
          startsAt: toLocal(c.startsAt),
          endsAt: toLocal(c.endsAt),
          minSubtotal: c.minSubtotal === null ? null : Number(c.minSubtotal),
          maxUses: c.maxUses,
          perUserLimit: c.perUserLimit,
          categoriesText: c.categories.join(","),
          storeIdsText: c.storeIds.join(","),
        }}
        isCreate={false}
        saving={saving.isPending}
        onSubmit={(values) =>
          save(
            { resource: "coupons", id, values },
            {
              onSuccess: () => toast.success("Coupon updated."),
              onError: (e) => toast.error((e as { message?: string })?.message ?? "Update failed."),
            }
          )
        }
      />

      <div>
        <Button
          size="sm"
          variant="destructive"
          disabled={deleting.isPending}
          onClick={() => {
            if (!window.confirm(`Delete coupon ${c.code}? Redemptions stay on past orders.`)) return;
            remove(
              { resource: "coupons", id },
              {
                onSuccess: () => router.push("/ys-admin/coupons"),
                onError: (e) => toast.error((e as { message?: string })?.message ?? "Delete failed."),
              }
            );
          }}
        >
          Delete coupon
        </Button>
      </div>
    </div>
  );
}
