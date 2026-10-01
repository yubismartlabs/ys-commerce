"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch, Controller, type Control, type FieldValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { FREE_AI_MODELS, GOOGLE_AI_MODELS } from "@/lib/settings";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
      <TextRow control={control} name="accountSlug" label="Account URL slug" hint="Prefix for the private account section, e.g. myebay → /myebay/summary. Lowercase letters/numbers/hyphens; changing it moves every account page immediately." />
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
      <SwitchRow control={control} name="enabled" label="Maintenance mode" hint="Guests see a full maintenance page; admins browse normally with a banner." />
      <TextareaRow control={control} name="message" label="Maintenance message" />
      <TextareaRow control={control} name="announcement" label="Announcement banner" hint="Shown above the storefront header until dismissed. Empty hides it." />
    </>
  );
}

export function CommerceFields({ control }: { control: C }) {
  return (
    <>
      <NumberRow control={control} name="commissionDefault" label="Default commission" hint="Fraction of each sale, e.g. 0.05 = 5%." step="0.01" min={0} />
      <SelectRow control={control} name="sellerApproval" label="Seller approval" hint="Auto lets anyone open a store and list instantly (eBay-style). Manual holds new stores as pending for review." options={["manual", "auto"]} />
      <TextareaRow control={control} name="buyerProtectionText" label="Buyer protection text" hint="Shown on product pages." />
      <NumberRow control={control} name="buyerProtectionDays" label="Buyer protection (days)" hint="Dispute-filing window after delivery." min={1} />
      <NumberRow control={control} name="escrowReleaseDays" label="Escrow release (days)" hint="Settling buffer after the buyer-protection window before funds release." min={0} />
    </>
  );
}

export function PaymentsFields({ control }: { control: C }) {
  return (
    <>
      <SelectRow control={control} name="provider" label="Payment provider" hint="Mock only — no card is charged and no money moves. Stripe is not wired up yet." options={["mock"]} />
      <TextRow control={control} name="currency" label="Currency" hint="Display only — all amounts are formatted as USD." />
      <SelectRow control={control} name="payoutSchedule" label="Payout schedule" hint="How long a payout must sit before it is paid out." options={["daily", "weekly", "monthly"]} />
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
      <TextRow control={control} name="shipFrom" label="Ships from" hint="Shown on product pages." />
    </>
  );
}

export function NotificationsFields({ control, hasResendKey }: { control: C; hasResendKey?: boolean }) {
  return (
    <>
      <TextRow control={control} name="adminAlertEmail" label="Admin alert email" hint="Order and dispute alerts land here." />
      <SwitchRow control={control} name="orderEmails" label="Order emails" hint="Buyer confirmations + admin copies on cancel/refund." />
      <SwitchRow control={control} name="disputeEmails" label="Dispute emails" hint="Buyer updates + admin copies on rulings." />
      <SwitchRow control={control} name="vendorEmails" label="Vendor emails" hint="Store owners on approve/suspend/reject." />
      <SwitchRow control={control} name="productEmails" label="Product emails" hint="Sellers on takedown/activation." />
      <SwitchRow control={control} name="adminAlerts" label="Admin alert emails" hint="Seller requests, new disputes and the ops digest." />
      <SwitchRow control={control} name="priceAlerts" label="Price & restock alerts" hint="Buyer wishlist price-drop and back-in-stock emails." />
      <SwitchRow control={control} name="lifecycle" label="Lifecycle emails" hint="Cart recovery, review requests and win-back campaigns." />
      <SwitchRow control={control} name="chatEmails" label="Chat notifications" hint="New-message nudges (never message content)." />
      <NumberRow control={control} name="lowStockThreshold" label="Low-stock threshold" hint="Variants at or below this count appear in the digest." min={0} />
      <TextRow control={control} name="fromEmail" label="From email" hint="Verified sender. Test domain can only reach the Resend account owner." />
      <TextRow control={control} name="replyTo" label="Reply-to email" hint="Optional. Replies go here instead of the sender." />
      <TextRow
        control={control}
        name="resendApiKey"
        label="Resend API key"
        hint={hasResendKey ? "A key is saved. Enter a new one to replace it; blank keeps it." : "Paste a Resend API key (re_...). Stored server-side, never shown again."}
        type="password"
        placeholder={hasResendKey ? "••••••••" : "re_..."}
      />
      <TextRow control={control} name="testRecipient" label="Test recipient" hint="Defaults the test-email button below." />
      <TextRow control={control} name="providerNote" label="Provider note" hint="Internal reminder of email setup state." />
    </>
  );
}

export function SecurityFields({ control }: { control: C }) {
  return (
    <>
      <NumberRow control={control} name="passwordMinLength" label="Minimum password length" min={8} />
      <SwitchRow control={control} name="allowAdminTokens" label="Allow mobile API tokens" hint="Bearer tokens for the mobile app and scripts. Off blocks all new tokens." />
    </>
  );
}

export function UsernamesFields({ control }: { control: C }) {
  return (
    <>
      <NumberRow control={control} name="minLength" label="Minimum length" hint="Floor for custom handles (3–10). Format rules always apply." min={3} />
      <NumberRow control={control} name="storeUsernameMaxChanges" label="Store username changes" hint="Lifetime renames per store (0 = permanent once chosen). Creation is always free." min={0} />
      <ReservedListRow control={control} />
    </>
  );
}

/**
 * Reserved-username editor. The schema stores `reserved: string[]`, but
 * operators think in comma/newline lists — this row parses one textarea
 * into the array on every keystroke (lowercased, de-duped, capped at 500).
 */
function ReservedListRow({ control }: { control: C }) {
  return (
    <Controller
      control={control}
      name="reserved"
      render={({ field }) => {
        const arr = Array.isArray(field.value) ? (field.value as string[]) : [];
        return (
          <div className="grid gap-1.5 py-3 sm:grid-cols-[220px_1fr] sm:gap-4">
            <div>
              <label htmlFor="reserved" className="text-sm font-medium">
                Reserved usernames
              </label>
              <p id="reserved-hint" className="text-xs text-neutral-500">
                Blocked at signup + store creation, one per line or comma-separated. Built-ins (admin, support, …) always apply.
              </p>
            </div>
            <div className="grid gap-1.5">
              <textarea
                id="reserved"
                aria-describedby="reserved-hint"
                rows={6}
                value={arr.join("\n")}
                onChange={(e) => {
                  const next = Array.from(
                    new Set(
                      e.target.value
                        .split(/[\n,]+/)
                        .map((s) => s.trim().toLowerCase())
                        .filter(Boolean)
                    )
                  ).slice(0, 500);
                  field.onChange(next);
                }}
                placeholder={"admin\nsupport\nlegit-brand"}
                className="max-w-xl rounded-lg border border-neutral-200 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-800 dark:bg-neutral-900"
              />
              <p className="text-xs text-neutral-500 tabular-nums">{arr.length} reserved</p>
            </div>
          </div>
        );
      }}
    />
  );
}

export function AiFields({ control, hasHfKey, hasGoogleKey }: { control: C; hasHfKey?: boolean; hasGoogleKey?: boolean }) {
  // Model options follow the provider: switching provider must not blank or
  // lose the saved model, so a value outside the current list is kept as a
  // pinned extra option until the admin picks from the list.
  const provider = useWatch({ control, name: "provider" });
  const currentModel = useWatch({ control, name: "model" });
  const baseModels: readonly string[] = provider === "google" ? GOOGLE_AI_MODELS : FREE_AI_MODELS;
  const modelOptions: readonly string[] =
    currentModel && !baseModels.includes(currentModel) ? [currentModel, ...baseModels] : baseModels;
  return (
    <>
      <SwitchRow control={control} name="enabled" label="Shopping assistant" hint="Show the left push-drawer assistant to signed-in buyers. Off hides it everywhere." />
      <TextRow control={control} name="name" label="Assistant name" hint="Shown in the navbar, drawer title and product-page button. Max 40 characters." placeholder="YS Assistant" />
      <SelectRow control={control} name="provider" label="Provider" hint="Google AI Studio (Gemini, pay-as-you-go) or Hugging Face free tier via the OpenAI-compatible router." options={["huggingface", "google"]} />
      <SelectRow
        control={control}
        name="model"
        label="Model"
        hint={
          provider === "google"
            ? "Gemini model for the Google AI Studio key."
            : "Hugging Face free-tier model. A :cheapest suffix is added automatically."
        }
        options={modelOptions}
      />
      <TextRow
        control={control}
        name="hfApiKey"
        label="Hugging Face token"
        hint={hasHfKey ? "A token is saved. Enter a new one to replace it; blank keeps it. HUGGINGFACE_API_KEY env also works." : "Paste a fine-grained token with Inference Providers permission (hf_...). Stored server-side, never shown again."}
        type="password"
        placeholder={hasHfKey ? "••••••••" : "hf_..."}
      />
      <TextRow
        control={control}
        name="googleApiKey"
        label="Google AI Studio key"
        hint={hasGoogleKey ? "A key is saved. Enter a new one to replace it; blank keeps it. GOOGLE_AI_API_KEY env also works." : "Paste a Gemini API key from Google AI Studio (aistudio.google.com → Get API key). Stored server-side, never shown again."}
        type="password"
        placeholder={hasGoogleKey ? "••••••••" : "AIza..."}
      />
      <NumberRow control={control} name="maxTokens" label="Max tokens" hint="Cap per reply to protect free credits (128–1024)." min={128} />
      <NumberRow control={control} name="temperature" label="Temperature" hint="0 = factual, 1 = creative. Keep low for shopping." step="0.1" min={0} />
      <NumberRow control={control} name="dailyLimitPerUser" label="Daily chats per buyer" hint="Quota guard for the free tier: hard ceiling 30/day per buyer (1–30)." min={1} />
      <NumberRow control={control} name="globalDailyCap" label="Global daily cap" hint="Kill-switch across all buyers before credits burn (10–10000)." min={10} />
    </>
  );
}

export function TestEmailButton({ defaultTo }: { defaultTo?: string }) {
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/v1/admin/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(to.trim() ? { to: to.trim() } : {}),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Send failed.");
      toast.success(`Test email sent to ${json?.data?.to ?? defaultTo ?? "recipient"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="flex flex-col gap-2 p-5 sm:flex-row sm:items-end">
      <div className="grid flex-1 gap-1.5">
        <p className="text-sm font-medium">Send a test email</p>
        <p className="text-xs text-neutral-500">
          Uses the saved key and sender. {defaultTo ? `Defaults to ${defaultTo}.` : null} On the Resend test
          domain, only the account owner&apos;s inbox receives mail.
        </p>
        <Input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder={defaultTo || "you@example.com"}
          className="max-w-md"
        />
      </div>
      <Button type="button" variant="outline" onClick={send} disabled={sending}>
        {sending ? <><Loader2 className="size-4 animate-spin" /> Sending…</> : <><Send className="size-4" /> Send test</>}
      </Button>
    </Card>
  );
}
