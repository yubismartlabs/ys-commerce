import { z } from "zod";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { getEmailConfig } from "@/lib/email/send";
import { testEmail } from "@/lib/email/templates";
import { sendAndLog } from "@/lib/notifications/notify";
import { getSettingGroup } from "@/lib/server-settings";

const bodySchema = z.object({
  to: z.string().email().optional(),
});

export const POST = withAdmin(async (req, actor) => {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Optional 'to' must be a valid email", 422);

  const config = await getEmailConfig();
  if (!config.enabled) {
    return fail("EMAIL", "Resend API key not configured. Save a key in Notifications settings or set RESEND_API_KEY.", 422);
  }

  const notifications = await getSettingGroup("notifications");
  const recipient = parsed.data.to || notifications.testRecipient || config.adminAlertEmail;
  if (!recipient) {
    return fail("VALIDATION", "No recipient. Provide 'to' or save a test recipient / admin alert email first.", 422);
  }

  // NOTE: Resend's test domain (onboarding@resend.dev) only delivers to the
  // Resend account owner's address. Use that inbox until a custom domain is verified.
  const result = await sendAndLog({
    to: recipient,
    template: testEmail({ siteName: config.siteName }),
    meta: { template: "test" },
  });
  if (!result.ok) {
    return fail("EMAIL", "Test email could not be sent — see the Email log for details", 502);
  }

  await audit(actor.id, "settings.testEmail", "Setting", "notifications", { to: recipient });
  return ok({ id: result.id, to: recipient });
}, "settings");
