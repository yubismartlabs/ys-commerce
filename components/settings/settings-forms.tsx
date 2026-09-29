"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type Control, type FieldValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import type { SettingGroup, Settings } from "@/lib/settings";
import { NumberRow, SelectRow, SwitchRow, TextRow, TextareaRow } from "@/components/settings/form-fields";
import { LogoRow } from "@/components/settings/logo-field";

export async function loadSettings(): Promise<Settings> {
  const res = await fetch("/api/v1/admin/settings");
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load settings.");
  return json.data as Settings;
}

export function useAdminSettings() {
  return useQuery({ queryKey: ["admin-settings"], queryFn: loadSettings });
}

export function GroupForm({
  group,
  schema,
  values,
  children,
}: {
  group: SettingGroup;
  schema: z.ZodTypeAny;
  values: FieldValues;
  children: (control: Control<FieldValues>) => React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const form = useForm({ resolver: zodResolver(schema as never) as unknown as Resolver<FieldValues>, defaultValues: values });

  useEffect(() => {
    form.reset(values);
  }, [form, values]);

  const save = async (v: FieldValues) => {
    const res = await fetch("/api/v1/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [group]: v }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error?.message ?? "Save failed.");
    toast.success(`${group} settings saved.`);
    queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
  };

  return (
    <form onSubmit={form.handleSubmit(save, () => toast.error("Fix the highlighted fields."))}>
      <Card className="divide-y px-5">
        {children(form.control)}
        <div className="flex justify-end py-4">
          <Button type="submit" disabled={form.formState.isSubmitting} className="bg-ali-red text-white hover:bg-ali-red-dark">
            {form.formState.isSubmitting ? (<><Loader2 className="size-4 animate-spin" /> Saving…</>) : "Save changes"}
          </Button>
        </div>
      </Card>
    </form>
  );
}

type C = Control<FieldValues>;

export function SiteFields({ control }: { control: C }) {
  return (
    <>
      <TextRow control={control} name="siteName" label="Site name" hint="Shown in the header and titles." />
      <LogoRow control={control} name="logoUrl" label="Logo" hint="PNG, JPEG, WebP or SVG, max 2MB." />
      <TextRow control={control} name="faviconUrl" label="Favicon URL" hint="Optional .ico or .png URL." />
      <TextRow control={control} name="supportEmail" label="Support email" hint="Shown on help pages." />
      <TextRow control={control} name="seoTitle" label="SEO title" hint="Default meta title." />
      <TextareaRow control={control} name="seoDescription" label="SEO description" hint="Default meta description." />
    </>
  );
}

export function MaintenanceFields({ control }: { control: C }) {
  return (
    <>
      <SwitchRow control={control} name="enabled" label="Maintenance mode" hint="Guests see a maintenance banner; admins browse normally." />
      <TextareaRow control={control} name="message" label="Maintenance message" />
      <TextareaRow control={control} name="announcement" label="Announcement banner" hint="Shown above the storefront header until dismissed. Empty hides it." />
    </>
  );
}

export function CommerceFields({ control }: { control: C }) {
  return (
    <>
      <NumberRow control={control} name="commissionDefault" label="Default commission" hint="Fraction of each sale, e.g. 0.05 = 5%." step="0.01" min={0} />
      <SelectRow control={control} name="sellerApproval" label="Seller approval" hint="Manual banks new stores as pending; auto approves." options={["manual", "auto"]} />
      <TextareaRow control={control} name="buyerProtectionText" label="Buyer protection text" hint="Shown on product pages." />
      <SwitchRow control={control} name="reviewModeration" label="Moderate reviews" hint="Hold new reviews for approval." />
    </>
  );
}

export function PaymentsFields({ control }: { control: C }) {
  return (
    <>
      <SelectRow control={control} name="provider" label="Payment provider" hint="Stripe wires up later; mock records nothing real." options={["mock", "stripe"]} />
      <TextRow control={control} name="currency" label="Currency" hint="Locked to USD for now." />
      <SelectRow control={control} name="payoutSchedule" label="Payout schedule" hint="How often sellers get paid." options={["daily", "weekly", "monthly"]} />
      <NumberRow control={control} name="payoutMinimum" label="Payout minimum (USD)" hint="Balance required before payout." min={0} />
    </>
  );
}

export function ShippingFields({ control }: { control: C }) {
  return (
    <>
      <NumberRow control={control} name="defaultFee" label="Default shipping fee (USD)" min={0} />
      <NumberRow control={control} name="freeThreshold" label="Free-shipping threshold (USD)" hint="Orders at or above ship free." min={0} />
      <TextRow control={control} name="etaText" label="Delivery promise" hint="Shown on product and checkout pages." />
      <TextRow control={control} name="shipFrom" label="Ships from" />
    </>
  );
}

export function NotificationsFields({ control }: { control: C }) {
  return (
    <>
      <TextRow control={control} name="adminAlertEmail" label="Admin alert email" hint="Order and dispute alerts land here." />
      <SwitchRow control={control} name="orderEmails" label="Order emails" hint="Confirmations and shipping updates." />
      <SwitchRow control={control} name="disputeEmails" label="Dispute emails" hint="New disputes and rulings." />
      <TextRow control={control} name="providerNote" label="Provider note" hint="Internal reminder of email setup state." />
    </>
  );
}

export function SecurityFields({ control }: { control: C }) {
  return (
    <>
      <NumberRow control={control} name="passwordMinLength" label="Minimum password length" min={8} />
      <NumberRow control={control} name="sessionLifetimeDays" label="Session lifetime (days)" hint="Display only — Auth.js default is 30 days." min={1} />
      <SwitchRow control={control} name="allowAdminTokens" label="Allow mobile API tokens" hint="Bearer tokens for the mobile app and scripts." />
    </>
  );
}
