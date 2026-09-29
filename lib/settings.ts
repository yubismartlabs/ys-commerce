import { z } from "zod";

/** Setting group keys stored as rows in the Setting table. */
export const SETTING_GROUPS = [
  "site",
  "commerce",
  "payments",
  "shipping",
  "notifications",
  "security",
  "maintenance",
] as const;

export type SettingGroup = (typeof SETTING_GROUPS)[number];

export const siteSchema = z.object({
  siteName: z.string().min(1).max(60).default("ys-commerce"),
  logoUrl: z.string().max(500).default(""),
  faviconUrl: z.string().max(500).default(""),
  supportEmail: z.string().email().or(z.literal("")).default(""),
  seoTitle: z.string().max(80).default("ys-commerce | Multi-vendor marketplace"),
  seoDescription: z.string().max(200).default("AliExpress-style multi-vendor marketplace."),
});

export const commerceSchema = z.object({
  commissionDefault: z.number().min(0).max(0.5).default(0.05),
  sellerApproval: z.enum(["auto", "manual"]).default("manual"),
  buyerProtectionText: z.string().max(500).default("Full refund if your order doesn't arrive."),
  reviewModeration: z.boolean().default(false),
});

export const paymentsSchema = z.object({
  provider: z.enum(["mock", "stripe"]).default("mock"),
  currency: z.string().default("USD"),
  payoutSchedule: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
  payoutMinimum: z.number().min(0).default(20),
});

export const shippingSchema = z.object({
  defaultFee: z.number().min(0).default(1.99),
  freeThreshold: z.number().min(0).default(25),
  etaText: z.string().max(120).default("Delivery in 7–12 days"),
  shipFrom: z.string().max(60).default("United States"),
});

export const notificationsSchema = z.object({
  adminAlertEmail: z.string().email().or(z.literal("")).default(""),
  orderEmails: z.boolean().default(true),
  disputeEmails: z.boolean().default(true),
  vendorEmails: z.boolean().default(true),
  productEmails: z.boolean().default(true),
  adminAlerts: z.boolean().default(true),
  lowStockThreshold: z.number().int().min(0).max(1000).default(5),
  fromEmail: z.string().email().or(z.literal("")).default("onboarding@resend.dev"),
  replyTo: z.string().email().or(z.literal("")).default(""),
  // Write-only: accepted on PATCH, never returned by GET (see admin settings route).
  resendApiKey: z.string().max(200).default(""),
  testRecipient: z.string().email().or(z.literal("")).default(""),
  providerNote: z.string().max(200).default("Resend sends order, dispute and vendor emails."),
});

export const securitySchema = z.object({
  passwordMinLength: z.number().int().min(8).max(32).default(8),
  sessionLifetimeDays: z.number().int().min(1).max(90).default(30),
  allowAdminTokens: z.boolean().default(true),
});

export const maintenanceSchema = z.object({
  enabled: z.boolean().default(false),
  message: z.string().max(300).default("We're performing scheduled maintenance. Back shortly."),
  announcement: z.string().max(300).default(""),
});

export const groupSchemas: Record<SettingGroup, z.ZodTypeAny> = {
  site: siteSchema,
  commerce: commerceSchema,
  payments: paymentsSchema,
  shipping: shippingSchema,
  notifications: notificationsSchema,
  security: securitySchema,
  maintenance: maintenanceSchema,
};

export type Settings = {
  site: z.infer<typeof siteSchema>;
  commerce: z.infer<typeof commerceSchema>;
  payments: z.infer<typeof paymentsSchema>;
  shipping: z.infer<typeof shippingSchema>;
  notifications: z.infer<typeof notificationsSchema>;
  security: z.infer<typeof securitySchema>;
  maintenance: z.infer<typeof maintenanceSchema>;
};

/** Defaults applied on seed and used as fallback when a row is missing. */
export function defaultSettings(): Settings {
  return {
    site: siteSchema.parse({}),
    commerce: commerceSchema.parse({}),
    payments: paymentsSchema.parse({}),
    shipping: shippingSchema.parse({}),
    notifications: notificationsSchema.parse({}),
    security: securitySchema.parse({}),
    maintenance: maintenanceSchema.parse({}),
  };
}

/** Public subset safe for the storefront + mobile (no secrets). */
export const publicSettingsSchema = z.object({
  siteName: z.string(),
  logoUrl: z.string(),
  announcement: z.string(),
  maintenance: z.object({ enabled: z.boolean(), message: z.string() }),
});
