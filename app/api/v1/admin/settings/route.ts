import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { getSettings } from "@/lib/server-settings";
import { groupSchemas, SETTING_GROUPS, type SettingGroup } from "@/lib/settings";

export const GET = withAdmin(async () => {
  const settings = await getSettings();
  return ok(maskSecrets(settings));
});

const patchSchema = z.object({}).catchall(z.record(z.string(), z.unknown())).refine(
  (v) => Object.keys(v).every((k) => (SETTING_GROUPS as readonly string[]).includes(k)),
  { message: `Only known groups can be updated: ${SETTING_GROUPS.join(", ")}` }
);

export const PATCH = withAdmin(async (req, actor) => {
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid payload", 422);

  const updated: SettingGroup[] = [];
  for (const [group, values] of Object.entries(parsed.data)) {
    const g = group as SettingGroup;
    const result = groupSchemas[g].safeParse(values);
    if (!result.success) {
      return fail("VALIDATION", `${g}: ${result.error.issues[0]?.message ?? "invalid values"}`, 422);
    }
    // Persist ONLY keys the client sent. Zod fills schema defaults for
    // missing keys — merging those would silently reset untouched settings.
    const sent = new Set(Object.keys((values ?? {}) as Record<string, unknown>));
    const validated = Object.fromEntries(
      Object.entries(result.data as unknown as Prisma.JsonObject).filter(([k]) => sent.has(k))
    );
    // resendApiKey / hfApiKey are write-only: blank means "keep the stored key", never wipe it.
    if (g === "notifications" && typeof validated.resendApiKey === "string" && validated.resendApiKey === "") {
      const current = await db.setting.findUnique({ where: { key: g } });
      const existing = (current?.value as Prisma.JsonObject | null)?.resendApiKey;
      if (typeof existing === "string" && existing !== "") {
        validated.resendApiKey = existing;
      } else {
        delete validated.resendApiKey;
      }
    }
    if (g === "ai") {
      // hfApiKey / googleApiKey are write-only: blank means "keep the stored key", never wipe it.
      for (const k of ["hfApiKey", "googleApiKey"] as const) {
        if (typeof (validated as Record<string, unknown>)[k] === "string" && (validated as Record<string, unknown>)[k] === "") {
          const current = await db.setting.findUnique({ where: { key: g } });
          const existing = (current?.value as Prisma.JsonObject | null)?.[k];
          if (typeof existing === "string" && existing !== "") {
            (validated as Record<string, unknown>)[k] = existing;
          } else {
            delete (validated as Record<string, unknown>)[k];
          }
        }
      }
    }
    const current = await db.setting.findUnique({ where: { key: g } });
    const merged = { ...((current?.value as Prisma.JsonObject) ?? {}), ...validated };
    await db.setting.upsert({
      where: { key: g },
      update: { value: merged },
      create: { key: g, value: validated },
    });
    updated.push(g);
  }

  await audit(actor.id, "settings.update", "Setting", updated.join(","), { groups: updated });
  return ok(maskSecrets(await getSettings()));
}, "settings");

// resendApiKey / hfApiKey / googleApiKey are write-only: expose only whether
// a key is configured, via env or DB, so the secret never leaves the server.
function maskSecrets(settings: Awaited<ReturnType<typeof getSettings>>) {
  const hasResendKey = Boolean(process.env.RESEND_API_KEY) || Boolean(settings.notifications.resendApiKey);
  const hasHfKey = Boolean(process.env.HUGGINGFACE_API_KEY) || Boolean(settings.ai.hfApiKey);
  const hasGoogleKey = Boolean(process.env.GOOGLE_AI_API_KEY) || Boolean(settings.ai.googleApiKey);
  return {
    ...settings,
    notifications: { ...settings.notifications, resendApiKey: "", hasResendKey },
    ai: { ...settings.ai, hfApiKey: "", googleApiKey: "", hasHfKey, hasGoogleKey },
  };
}
