import { Resend } from "resend";
import { getSettings } from "@/lib/server-settings";
import type { EmailTemplate } from "@/lib/email/templates";

export type EmailConfig = {
  /** False when no API key is configured — callers should skip sending. */
  enabled: boolean;
  from: string;
  replyTo?: string;
  adminAlertEmail: string;
  siteName: string;
  orderEmails: boolean;
  disputeEmails: boolean;
  vendorEmails: boolean;
  productEmails: boolean;
  adminAlerts: boolean;
  lowStockThreshold: number;
};

/** Resolve sender config from DB settings with env fallback. Never throws. */
export async function getEmailConfig(): Promise<EmailConfig> {
  const settings = await getSettings();
  const apiKey = settings.notifications.resendApiKey || process.env.RESEND_API_KEY || "";
  return {
    enabled: Boolean(apiKey),
    from: settings.notifications.fromEmail || process.env.EMAIL_FROM || "onboarding@resend.dev",
    replyTo: settings.notifications.replyTo || undefined,
    adminAlertEmail: settings.notifications.adminAlertEmail,
    siteName: settings.site.siteName || "ys-commerce",
    orderEmails: settings.notifications.orderEmails,
    disputeEmails: settings.notifications.disputeEmails,
    vendorEmails: settings.notifications.vendorEmails,
    productEmails: settings.notifications.productEmails,
    adminAlerts: settings.notifications.adminAlerts,
    lowStockThreshold: settings.notifications.lowStockThreshold,
  };
}

function getApiKey(settingsKey: string): string {
  // Prefer the DB-stored key; fall back to env. getEmailConfig already
  // computed `enabled` the same way, so this stays consistent.
  return settingsKey || process.env.RESEND_API_KEY || "";
}

export type SendResult = { ok: true; id?: string } | { ok: false; skipped?: boolean; error?: string };

/**
 * Send one transactional email. Never throws: failures are returned so
 * admin mutations (order/dispute/vendor updates) are never blocked by mail.
 */
export async function sendEmail(opts: {
  to: string | string[];
  template: EmailTemplate;
  replyTo?: string;
}): Promise<SendResult> {
  const settings = await getSettings();
  const apiKey = getApiKey(settings.notifications.resendApiKey);
  if (!apiKey) {
    console.warn("[email] skipped — no Resend API key configured");
    return { ok: false, skipped: true };
  }
  const to = Array.isArray(opts.to) ? opts.to.filter(Boolean) : [opts.to];
  if (to.length === 0) return { ok: false, skipped: true };

  try {
    const resend = new Resend(apiKey);
    const from = settings.notifications.fromEmail || process.env.EMAIL_FROM || "onboarding@resend.dev";
    const replyTo = opts.replyTo ?? settings.notifications.replyTo ?? undefined;
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: opts.template.subject,
      html: opts.template.html,
      text: opts.template.text,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error("[email] resend error", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "send failed";
    console.error("[email] send failed", message);
    return { ok: false, error: message };
  }
}
