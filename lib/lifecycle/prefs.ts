import { db } from "@/lib/db";
import { getSettings } from "@/lib/server-settings";

export type BuyerPrefs = { priceAlerts: boolean; lifecycle: boolean; chat: boolean };

/** Effective buyer comms prefs: global toggles ANDed with per-user opt-outs. */
export async function buyerPrefs(userId: string): Promise<BuyerPrefs> {
  const [settings, user] = await Promise.all([
    getSettings(),
    db.user.findUnique({ where: { id: userId }, select: { prefs: true } }),
  ]);
  const p = (user?.prefs ?? {}) as Record<string, unknown>;
  const master = p.lifecycle !== false;
  return {
    priceAlerts: settings.notifications.priceAlerts && p.priceAlerts !== false && master,
    lifecycle: settings.notifications.lifecycle && master,
    chat: settings.notifications.chatEmails && master,
  };
}
