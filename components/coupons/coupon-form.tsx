"use client";

import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { NumberRow, SelectRow, SwitchRow, TextRow } from "@/components/settings/form-fields";

const formSchema = z.object({
  code: z.string().optional(),
  type: z.enum(["PERCENT", "FIXED", "FREESHIP"]),
  pctOff: z.number().int().min(1).max(90).optional(),
  amountOff: z.number().min(0.01).max(100000).optional(),
  active: z.boolean(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  minSubtotal: z.number().min(0).max(1000000).optional().nullable(),
  maxUses: z.number().int().min(0).max(1000000).optional().nullable(),
  perUserLimit: z.number().int().min(0).max(1000).optional().nullable(),
  categoriesText: z.string(),
  storeIdsText: z.string(),
}).superRefine((v, ctx) => {
  if (v.type === "PERCENT" && v.pctOff === undefined) {
    ctx.addIssue({ code: "custom", message: "Percent off (1–90) is required." });
  }
  if (v.type === "FIXED" && v.amountOff === undefined) {
    ctx.addIssue({ code: "custom", message: "Amount off is required." });
  }
});

export type CouponFormValues = z.infer<typeof formSchema>;

/** "2026-09-29T12:00:00.000Z" -> "2026-09-29T12:00" for datetime-local inputs. */
export function toLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const zeroToNull = (n: number | null | undefined): number | null =>
  n === null || n === undefined || n === 0 ? null : n;

export function CouponForm({
  defaults,
  isCreate,
  saving,
  onSubmit,
}: {
  defaults: Partial<CouponFormValues>;
  isCreate: boolean;
  saving: boolean;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const form = useForm<CouponFormValues>({
    resolver: zodResolver(formSchema) as unknown as Resolver<CouponFormValues>,
    defaultValues: {
      type: "PERCENT",
      active: true,
      categoriesText: "",
      storeIdsText: "",
      ...defaults,
    },
  });

  useEffect(() => {
    form.reset({
      type: "PERCENT",
      active: true,
      categoriesText: "",
      storeIdsText: "",
      ...defaults,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults.code]);

  const type = form.watch("type");

  const submit = (v: CouponFormValues) => {
    const categories = v.categoriesText.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const storeIds = v.storeIdsText.split(",").map((s) => s.trim()).filter(Boolean);
    const payload: Record<string, unknown> = {
      type: v.type,
      active: v.active,
      ...(v.type === "PERCENT" ? { pctOff: v.pctOff } : {}),
      ...(v.type === "FIXED" ? { amountOff: v.amountOff } : {}),
      startsAt: v.startsAt ? new Date(v.startsAt).toISOString() : null,
      endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : null,
      minSubtotal: zeroToNull(v.minSubtotal),
      maxUses: zeroToNull(v.maxUses),
      perUserLimit: zeroToNull(v.perUserLimit),
      categories,
      storeIds,
    };
    if (isCreate) payload.code = (v.code ?? "").trim().toUpperCase();
    onSubmit(payload);
  };

  return (
    <form onSubmit={form.handleSubmit(submit, () => toast.error("Fix the highlighted fields."))}>
      <Card className="divide-y px-5">
        {isCreate ? (
          <TextRow control={form.control} name="code" label="Code" hint="Uppercase, 3–32 chars. Immutable after creation." placeholder="SUMMER20" />
        ) : null}
        <SelectRow control={form.control} name="type" label="Discount type" options={["PERCENT", "FIXED", "FREESHIP"]} />
        {type === "PERCENT" ? (
          <NumberRow control={form.control} name="pctOff" label="Percent off" hint="1–90." min={1} />
        ) : null}
        {type === "FIXED" ? (
          <NumberRow control={form.control} name="amountOff" label="Amount off (USD)" hint="Capped at the eligible subtotal." min={0} />
        ) : null}
        <SwitchRow control={form.control} name="active" label="Active" hint="Inactive codes are rejected at checkout." />
        <TextRow control={form.control} name="startsAt" label="Starts at" hint="Local time; empty = immediately." type="datetime-local" />
        <TextRow control={form.control} name="endsAt" label="Ends at" hint="Local time; empty = no expiry." type="datetime-local" />
        <NumberRow control={form.control} name="minSubtotal" label="Minimum subtotal (USD)" hint="On eligible items. 0 = none." min={0} />
        <NumberRow control={form.control} name="maxUses" label="Total usage cap" hint="0 = unlimited." min={0} />
        <NumberRow control={form.control} name="perUserLimit" label="Per-user limit" hint="0 = unlimited." min={0} />
        <TextRow control={form.control} name="categoriesText" label="Categories" hint="Comma-separated slugs, e.g. electronics,fashion. Empty = all." placeholder="electronics,fashion" />
        <TextRow control={form.control} name="storeIdsText" label="Store IDs" hint="Comma-separated store IDs. Empty = all stores." placeholder="cm…" />
        <div className="flex justify-end py-4">
          <Button type="submit" disabled={saving} className="bg-ali-red text-white hover:bg-ali-red-dark">
            {saving ? (<><Loader2 className="size-4 animate-spin" /> Saving…</>) : isCreate ? "Create coupon" : "Save changes"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
