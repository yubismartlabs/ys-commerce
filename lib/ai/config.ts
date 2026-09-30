import { getSettingGroup } from "@/lib/server-settings";
import { FREE_AI_MODELS } from "@/lib/settings";

export type AiConfig = {
  enabled: boolean;
  model: string;
  token: string | null;
  hasToken: boolean;
  maxTokens: number;
  temperature: number;
  dailyLimitPerUser: number;
  globalDailyCap: number;
};

/** Resolve assistant config. Token: env wins, DB second. Model clamped to the free-tier allowlist. */
export async function getAiConfig(): Promise<AiConfig> {
  const ai = await getSettingGroup("ai");
  const envToken = process.env.HUGGINGFACE_API_KEY?.trim() || null;
  const dbToken = ai.hfApiKey?.trim() || null;
  const model = FREE_AI_MODELS.includes(ai.model as (typeof FREE_AI_MODELS)[number])
    ? ai.model
    : "meta-llama/Meta-Llama-3.1-8B-Instruct";
  return {
    enabled: ai.enabled,
    model,
    token: envToken ?? dbToken,
    hasToken: Boolean(envToken ?? dbToken),
    maxTokens: ai.maxTokens,
    temperature: ai.temperature,
    dailyLimitPerUser: ai.dailyLimitPerUser,
    globalDailyCap: ai.globalDailyCap,
  };
}
