import { getSettingGroup } from "@/lib/server-settings";
import { FREE_AI_MODELS, GOOGLE_AI_MODELS } from "@/lib/settings";

export type AiProvider = "huggingface" | "google";

export type AiConfig = {
  enabled: boolean;
  name: string;
  provider: AiProvider;
  model: string;
  token: string | null;
  hasToken: boolean;
  maxTokens: number;
  temperature: number;
  dailyLimitPerUser: number;
  globalDailyCap: number;
};

/** Resolve assistant config. Token: env wins, DB second. Model clamped to the provider allowlist. */
export async function getAiConfig(): Promise<AiConfig> {
  const ai = await getSettingGroup("ai");
  const provider: AiProvider = ai.provider === "google" ? "google" : "huggingface";

  if (provider === "google") {
    const envToken = process.env.GOOGLE_AI_API_KEY?.trim() || null;
    const dbToken = ai.googleApiKey?.trim() || null;
    const wanted = (ai.model ?? "").trim();
    const model = (GOOGLE_AI_MODELS as readonly string[]).includes(wanted) ? wanted : "gemini-3.8-flash";
    return {
      enabled: ai.enabled,
      name: ai.name?.trim() || "YS Assistant",
      provider,
      model,
      token: envToken ?? dbToken,
      hasToken: Boolean(envToken ?? dbToken),
      maxTokens: ai.maxTokens,
      temperature: ai.temperature,
      dailyLimitPerUser: ai.dailyLimitPerUser,
      globalDailyCap: ai.globalDailyCap,
    };
  }

  const envToken = process.env.HUGGINGFACE_API_KEY?.trim() || null;
  const dbToken = ai.hfApiKey?.trim() || null;
  // The router requires a provider/policy suffix (model:cheapest etc).
  // Strip it for allowlist validation, then re-attach :cheapest so a bare
  // admin-entered id still routes — and routes to the cheapest provider to
  // protect the $0.10/mo free credits.
  const bare = (ai.model ?? "").split(":")[0]?.trim() ?? "";
  const valid = FREE_AI_MODELS.includes(bare as (typeof FREE_AI_MODELS)[number])
    ? bare
    : "meta-llama/Llama-3.1-8B-Instruct";
  const model = (ai.model ?? "").includes(":") ? (ai.model as string) : `${valid}:cheapest`;
  return {
    enabled: ai.enabled,
    name: ai.name?.trim() || "YS Assistant",
    provider,
    model,
    token: envToken ?? dbToken,
    hasToken: Boolean(envToken ?? dbToken),
    maxTokens: ai.maxTokens,
    temperature: ai.temperature,
    dailyLimitPerUser: ai.dailyLimitPerUser,
    globalDailyCap: ai.globalDailyCap,
  };
}
