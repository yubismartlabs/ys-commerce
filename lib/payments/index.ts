import { log } from "@/lib/logger";
import { getSettingGroup } from "@/lib/server-settings";
import { mockProvider } from "./mock";
import { PaymentError, type Provider } from "./types";

export * from "./types";
export { mockProvider } from "./mock";

/**
 * Resolve the configured provider.
 *
 * Only the mock exists. The switch is kept deliberately: it is the single place
 * a real provider gets wired in, and the shape of the failure matters. A
 * provider that is selected but not configured must be a hard error, never a
 * silent fallback to the mock — a deployment that meant to take money but was
 * missing a key would otherwise mark orders paid and charge nobody, while the
 * storefront looked exactly the same.
 */
export async function getConfiguredProvider(): Promise<Provider> {
  let configured = "mock";
  try {
    const payments = await getSettingGroup("payments");
    configured = payments.provider;
  } catch (e) {
    log.error("payments: could not read settings, defaulting to mock", { err: e });
    return mockProvider;
  }

  switch (configured) {
    case "mock":
      return mockProvider;
    default:
      throw new PaymentError(
        `Payment provider "${configured}" is not implemented. Only "mock" is available; a configured-but-missing provider must not silently fall back to mock, because that marks orders paid without charging anyone.`,
        String(configured),
        "NOT_CONFIGURED"
      );
  }
}
