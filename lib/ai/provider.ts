import { log } from "@/lib/logger";

export type HfMessage = { role: "system" | "user" | "assistant"; content: string };

export class AiUpstreamError extends Error {
  constructor(
    public kind: "quota" | "cold" | "upstream",
    message: string
  ) {
    super(message);
  }
}

/**
 * Hugging Face Inference Providers via the OpenAI-compatible router.
 * Free tier: credit-metered, cold starts common, 402/429 when credits burn.
 * Non-streaming JSON keeps the server path simple + quota-predictable.
 */
export async function chatWithHf(opts: {
  token: string;
  model: string;
  messages: HfMessage[];
  maxTokens: number;
  temperature: number;
}): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        stream: false,
      }),
    });
    if (res.status === 402 || res.status === 429) {
      throw new AiUpstreamError("quota", "Assistant limit reached — free-tier credits are spent. Try again tomorrow; browsing still works.");
    }
    if (res.status === 503 || res.status === 529) {
      throw new AiUpstreamError("cold", "The model is warming up (free-tier cold start). Retry in ~30 seconds.");
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.warn("hf chat failed", { status: res.status, body: body.slice(0, 300) });
      throw new AiUpstreamError("upstream", "Assistant is briefly unavailable. Please retry.");
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new AiUpstreamError("upstream", "Empty reply from the model. Please retry.");
    return text.slice(0, 2000);
  } catch (e) {
    if (e instanceof AiUpstreamError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new AiUpstreamError("cold", "Request timed out (likely a cold start). Retry in a moment.");
    }
    throw new AiUpstreamError("upstream", "Assistant is briefly unavailable. Please retry.");
  } finally {
    clearTimeout(timer);
  }
}
