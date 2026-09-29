"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type Control, type FieldValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  Bell,
  CreditCard,
  Globe,
  Loader2,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { groupSchemas, type SettingGroup, type Settings } from "@/lib/settings";
import { NumberRow, SelectRow, SwitchRow, TextRow, TextareaRow } from "@/components/settings/form-fields";
import { LogoRow } from "@/components/settings/logo-field";
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from "@/components/refine/ui";

async function loadSettings(): Promise<Settings> {
  const res = await fetch("/api/v1/admin/settings");
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load settings.");
  return json.data as Settings;
}

function GroupForm({
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

const TABS: Array<{ id: SettingGroup; label: string; icon: React.ReactNode; hint: string }> = [
  { id: "site", label: "Site", icon: <Globe className="size-4" />, hint: "Brand identity and SEO defaults." },
  { id: "commerce", label: "Commerce", icon: <ShoppingBag className="size-4" />, hint: "Commissions, seller onboarding and buyer protection." },
  { id: "payments", label: "Payments", icon: <CreditCard className="size-4" />, hint: "Providers, currency and payout schedule." },
  { id: "shipping", label: "Shipping", icon: <Truck className="size-4" />, hint: "Default fees, thresholds and delivery promises." },
  { id: "notifications", label: "Notifications", icon: <Bell className="size-4" />, hint: "Who gets emailed, and when." },
  { id: "security", label: "Security", icon: <ShieldCheck className="size-4" />, hint: "Passwords, sessions and API access." },
  { id: "maintenance", label: "Maintenance", icon: <Wrench className="size-4" />, hint: "Maintenance mode and site-wide announcements." },
];

export default function SettingsPage() {
  const query = useQuery({ queryKey: ["admin-settings"], queryFn: loadSettings });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Settings" description="Site and system configuration." />
        <Card className="p-0"><TableSkeleton rows={6} cols={2} /></Card>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Settings" description="Site and system configuration." />
        <Card className="p-0"><ErrorState message="Failed to load settings." /></Card>
      </div>
    );
  }

  const s = query.data;
  if (Object.keys(s).length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Settings" description="Site and system configuration." />
        <Card className="p-0"><EmptyState title="No settings found" hint="Run the database seed to create defaults." /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="Site and system configuration. Changes save per tab." />
      <Tabs defaultValue="site">
        <TabsList className="flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
              {t.icon} {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="site">
          <GroupForm group="site" schema={groupSchemas.site} values={s.site}>
            {(c) => (
              <>
                <TextRow control={c} name="siteName" label="Site name" hint="Shown in the header and titles." />
                <LogoRow control={c} name="logoUrl" label="Logo" hint="PNG, JPEG, WebP or SVG, max 2MB." />
                <TextRow control={c} name="faviconUrl" label="Favicon URL" hint="Optional .ico or .png URL." />
                <TextRow control={c} name="supportEmail" label="Support email" hint="Shown on help pages." />
                <TextRow control={c} name="seoTitle" label="SEO title" hint="Default meta title." />
                <TextareaRow control={c} name="seoDescription" label="SEO description" hint="Default meta description." />
              </>
            )}
          </GroupForm>
        </TabsContent>

        <TabsContent value="commerce">
          <GroupForm group="commerce" schema={groupSchemas.commerce} values={s.commerce}>
            {(c) => (
              <>
                <NumberRow control={c} name="commissionDefault" label="Default commission" hint="Fraction of each sale, e.g. 0.05 = 5%." step="0.01" min={0} />
                <SelectRow control={c} name="sellerApproval" label="Seller approval" hint="Manual banks new stores as pending; auto approves." options={["manual", "auto"]} />
                <TextareaRow control={c} name="buyerProtectionText" label="Buyer protection text" hint="Shown on product pages." />
                <SwitchRow control={c} name="reviewModeration" label="Moderate reviews" hint="Hold new reviews for approval." />
              </>
            )}
          </GroupForm>
        </TabsContent>

        <TabsContent value="payments">
          <GroupForm group="payments" schema={groupSchemas.payments} values={s.payments}>
            {(c) => (
              <>
                <SelectRow control={c} name="provider" label="Payment provider" hint="Stripe wires up later; mock records nothing real." options={["mock", "stripe"]} />
                <TextRow control={c} name="currency" label="Currency" hint="Locked to USD for now." />
                <SelectRow control={c} name="payoutSchedule" label="Payout schedule" hint="How often sellers get paid." options={["daily", "weekly", "monthly"]} />
                <NumberRow control={c} name="payoutMinimum" label="Payout minimum (USD)" hint="Balance required before payout." min={0} />
              </>
            )}
          </GroupForm>
        </TabsContent>

        <TabsContent value="shipping">
          <GroupForm group="shipping" schema={groupSchemas.shipping} values={s.shipping}>
            {(c) => (
              <>
                <NumberRow control={c} name="defaultFee" label="Default shipping fee (USD)" min={0} />
                <NumberRow control={c} name="freeThreshold" label="Free-shipping threshold (USD)" hint="Orders at or above ship free." min={0} />
                <TextRow control={c} name="etaText" label="Delivery promise" hint="Shown on product and checkout pages." />
                <TextRow control={c} name="shipFrom" label="Ships from" />
              </>
            )}
          </GroupForm>
        </TabsContent>

        <TabsContent value="notifications">
          <GroupForm group="notifications" schema={groupSchemas.notifications} values={s.notifications}>
            {(c) => (
              <>
                <TextRow control={c} name="adminAlertEmail" label="Admin alert email" hint="Order and dispute alerts land here." />
                <SwitchRow control={c} name="orderEmails" label="Order emails" hint="Confirmations and shipping updates." />
                <SwitchRow control={c} name="disputeEmails" label="Dispute emails" hint="New disputes and rulings." />
                <TextRow control={c} name="providerNote" label="Provider note" hint="Internal reminder of email setup state." />
              </>
            )}
          </GroupForm>
        </TabsContent>

        <TabsContent value="security">
          <GroupForm group="security" schema={groupSchemas.security} values={s.security}>
            {(c) => (
              <>
                <NumberRow control={c} name="passwordMinLength" label="Minimum password length" min={8} />
                <NumberRow control={c} name="sessionLifetimeDays" label="Session lifetime (days)" hint="Display only — Auth.js default is 30 days." min={1} />
                <SwitchRow control={c} name="allowAdminTokens" label="Allow mobile API tokens" hint="Bearer tokens for the mobile app and scripts." />
              </>
            )}
          </GroupForm>
        </TabsContent>

        <TabsContent value="maintenance">
          <GroupForm group="maintenance" schema={groupSchemas.maintenance} values={s.maintenance}>
            {(c) => (
              <>
                <SwitchRow control={c} name="enabled" label="Maintenance mode" hint="Guests see a maintenance banner; admins browse normally." />
                <TextareaRow control={c} name="message" label="Maintenance message" />
                <TextareaRow control={c} name="announcement" label="Announcement banner" hint="Shown above the storefront header until dismissed. Empty hides it." />
              </>
            )}
          </GroupForm>
        </TabsContent>
      </Tabs>
    </div>
  );
}
