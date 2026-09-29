import { db } from "@/lib/db";
import { defaultSettings, type Settings } from "@/lib/settings";

/** Load all settings merged over defaults (missing rows fall back safely). */
export async function getSettings(): Promise<Settings> {
  const defaults = defaultSettings();
  const rows = await db.setting.findMany();
  const out: Record<string, Record<string, unknown>> = { ...(defaults as unknown as Record<string, Record<string, unknown>>) };
  for (const row of rows) {
    if (row.key in out) {
      out[row.key] = { ...out[row.key], ...((row.value as Record<string, unknown>) ?? {}) };
    }
  }
  return out as unknown as Settings;
}

export async function getSettingGroup<K extends keyof Settings>(group: K): Promise<Settings[K]> {
  const all = await getSettings();
  return all[group];
}
