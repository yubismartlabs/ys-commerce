import { z } from "zod";
import { describeImagePolicy, isAllowedImageUrl } from "@/lib/images";
import { DEFAULT_RESERVED_USERNAMES, normalizeUsername } from "@/lib/usernames";

/** Setting group keys stored as rows in the Setting table. */
export const SETTING_GROUPS = [
  "site",
  "commerce",
  "payments",
  "shipping",
  "notifications",
  "security",
  "maintenance",
  "usernames",
  "ai",
] as const;

export type SettingGroup = (typeof SETTING_GROUPS)[number];

/** Optional admin image field: blank is valid, but a bad host is not —
 * `next/image` throws at render for hosts missing from remotePatterns. */
const siteImage = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || isAllowedImageUrl(v), { message: describeImagePolicy() })
  .default("");

export const siteSchema = z.object({
  siteName: z.string().min(1).max(60).default("ys-commerce"),
  logoUrl: siteImage,
  faviconUrl: siteImage,
  supportEmail: z.string().email().or(z.literal("")).default(""),
  seoTitle: z.string().max(80).default("ys-commerce | Multi-vendor marketplace"),
  seoDescription: z.string().max(200).default("AliExpress-style multi-vendor marketplace."),
  // URL prefix for the private account section (e.g. "myebay" → /myebay/summary).
  // Must not shadow a top-level marketplace route, so it is checked against
  // the same reserved list as usernames (which covers route names).
  accountSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
      message: "Account slug: 2–30 lowercase letters/numbers/hyphens.",
    })
    .refine(
      (v) =>
        normalizeUsername(v) === "account" ||
        !(DEFAULT_RESERVED_USERNAMES as readonly string[]).includes(normalizeUsername(v)),
      { message: "That slug is reserved — pick another one." }
    )
    .default("account"),
});

export const commerceSchema = z.object({
  commissionDefault: z.number().min(0).max(0.5).default(0.05),
  // eBay-style: anyone can list immediately. "auto" approves new stores on
  // creation so a buyer becomes a seller in one click; "manual" keeps the
  // approval queue for operators who want to review sellers first.
  sellerApproval: z.enum(["auto", "manual"]).default("auto"),
  buyerProtectionText: z.string().max(500).default("Full refund if your order doesn't arrive."),
  buyerProtectionDays: z.number().int().min(1).max(90).default(14),
  escrowReleaseDays: z.number().int().min(0).max(90).default(14),
  reviewModeration: z.boolean().default(false),
});

export const paymentsSchema = z.object({
  provider: z.enum(["mock"]).default("mock"),
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
  priceAlerts: z.boolean().default(true),
  lifecycle: z.boolean().default(true),
  chatEmails: z.boolean().default(true),
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
  allowAdminTokens: z.boolean().default(true),
  /**
   * Multiplier on every rate-limit ceiling. 1 = the coded budgets. Operators
   * can widen them during a traffic spike or a support drive without a deploy;
   * lowering below 1 tightens them, which is the useful direction when an
   * endpoint is being abused.
   */
  rateLimitMultiplier: z.number().min(0.1).max(1000).default(1),
});

export const maintenanceSchema = z.object({
  enabled: z.boolean().default(false),
  message: z.string().max(300).default("We're performing scheduled maintenance. Back shortly."),
  announcement: z.string().max(300).default(""),
});

/**
 * Username policy. `reserved` is the operator-managed blocklist, merged over
 * DEFAULT_RESERVED_USERNAMES in lib/usernames — entries like "admin" can
 * never be claimed even if removed here (the built-ins always apply).
 */
export const usernamesSchema = z.object({
  reserved: z
    .array(z.string().trim().min(1).max(30))
    .max(500)
    .default([]),
  minLength: z.number().int().min(3).max(10).default(3),
  // Lifetime cap on store-username renames (creation is always free).
  // 0 = handles are permanent once chosen.
  storeUsernameMaxChanges: z.number().int().min(0).max(10).default(2),
});

export const DEFAULT_RESERVED_NOTE =
  "Every account gets an auto-generated handle at signup (from the display name). A custom handle can only be claimed when opening a store, must be 3–30 lowercase letters/numbers with . _ - (starting and ending with a letter or number), must be unique across users AND stores, and is checked against the built-in impersonation/route blocklist plus the reserved list on this page. Stores also get a public @username (their /store/@handle URL); renames are capped for life by the setting above.";

/**
 * Shopping-assistant (Alexa-for-Shopping style) configuration.
 * Hugging Face free tier is credit-metered (~$0.10/mo, ~1k req/day, <10B
 * params, cold starts), so defaults are conservative: disabled until an
 * operator opts in, small maxTokens, and per-user + global daily caps.
 * hfApiKey is write-only like notifications.resendApiKey.
 */
export const FREE_AI_MODELS = [
  "meta-llama/Llama-3.1-8B-Instruct",
  "google/gemma-3-4b-it",
  "Qwen/Qwen2.5-7B-Instruct",
  "mistralai/Mistral-7B-Instruct-v0.3",
] as const;

/**
 * Gemini models for the Google AI Studio provider. Google retires old Flash
 * versions for new keys (gemini-2.5-flash now 404s), so this tracks the
 * current generation — the config clamps anything older to the default.
 */
export const GOOGLE_AI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
] as const;

export const aiSchema = z.object({
  enabled: z.boolean().default(false),
  name: z.string().trim().min(1).max(40).default("YS Assistant"),
  provider: z.enum(["huggingface", "google"]).default("huggingface"),
  model: z.string().min(1).max(120).default("meta-llama/Llama-3.1-8B-Instruct"),
  hfApiKey: z.string().max(200).default(""),
  googleApiKey: z.string().max(200).default(""),
  maxTokens: z.number().int().min(128).max(1024).default(350),
  temperature: z.number().min(0).max(1).default(0.2),
  dailyLimitPerUser: z.number().int().min(1).max(30).default(30),
  globalDailyCap: z.number().int().min(10).max(10000).default(800),
});

export const groupSchemas: Record<SettingGroup, z.ZodTypeAny> = {
  site: siteSchema,
  commerce: commerceSchema,
  payments: paymentsSchema,
  shipping: shippingSchema,
  notifications: notificationsSchema,
  security: securitySchema,
  maintenance: maintenanceSchema,
  usernames: usernamesSchema,
  ai: aiSchema,
};

export type Settings = {
  site: z.infer<typeof siteSchema>;
  commerce: z.infer<typeof commerceSchema>;
  payments: z.infer<typeof paymentsSchema>;
  shipping: z.infer<typeof shippingSchema>;
  notifications: z.infer<typeof notificationsSchema>;
  security: z.infer<typeof securitySchema>;
  maintenance: z.infer<typeof maintenanceSchema>;
  usernames: z.infer<typeof usernamesSchema>;
  ai: z.infer<typeof aiSchema>;
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
    usernames: usernamesSchema.parse({}),
    ai: aiSchema.parse({}),
  };
}

/** Public subset safe for the storefront + mobile (no secrets). */
export const publicSettingsSchema = z.object({
  siteName: z.string(),
  logoUrl: z.string(),
  accountSlug: z.string(),
  announcement: z.string(),
  buyerProtectionText: z.string(),
  buyerProtectionDays: z.number(),
  // Surfaced on the product page so the storefront shows the operator's
  // configured delivery promise instead of a hardcoded "7–12 days".
  etaText: z.string(),
  shipFrom: z.string(),
  maintenance: z.object({ enabled: z.boolean(), message: z.string() }),
  aiEnabled: z.boolean(),
});
