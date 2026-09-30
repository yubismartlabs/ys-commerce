import { db } from "@/lib/db";
import { defaultSettings, type Settings } from "@/lib/settings";

/**
 * Load all settings merged over defaults (missing rows fall back safely).
 *
 * The storefront renders on every request, so a database blip here would take
 * down the entire site. Serve defaults and let the admin console surface the
 * real error instead of failing the shopper.
 */
export async function getSettings(): Promise<Settings> {
  const defaults = defaultSettings();
  let rows;
  try {
    rows = await db.setting.findMany();
  } catch (e) {
    console.error("[settings] falling back to defaults:", e);
    return defaults;
  }
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
