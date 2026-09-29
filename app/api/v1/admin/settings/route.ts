import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { getSettings } from "@/lib/server-settings";
import { groupSchemas, SETTING_GROUPS, type SettingGroup } from "@/lib/settings";

export const GET = withAdmin(async () => {
  return ok(await getSettings());
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
    const validated = result.data as unknown as Prisma.JsonObject;
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
  return ok(await getSettings());
});
