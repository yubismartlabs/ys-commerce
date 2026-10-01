import { log } from "@/lib/logger";

export type HfMessage = { role: "system" | "user" | "assistant"; content: string };

export class AiUpstreamError extends Error {
  constructor(
    public kind: "quota" | "cold" | "upstream" | "config",
    message: string
  ) {
    super(message);
  }
}

type GooglePart = { text?: string };
type GoogleContent = { role?: string; parts?: GooglePart[] };

function googleErrorKind(status: number, body: string): AiUpstreamError {
  if (status === 429) {
    return new AiUpstreamError("quota", "Assistant limit reached — the Google AI key is out of quota. Try again later; browsing still works.");
  }
  if (status === 503 || status === 529) {
    return new AiUpstreamError("cold", "Google AI is overloaded right now. Retry in a moment.");
  }
  if (status === 400 || status === 404) {
    // Invalid key, unknown model, or bad request — all admin-fixable.
    return new AiUpstreamError("config", "Assistant is misconfigured (bad Google AI key or unknown model). Ask an admin to check System settings → AI Assistant.");
  }
  log.warn("google ai chat failed", { status, body: body.slice(0, 300) });
  return new AiUpstreamError("upstream", "Assistant is briefly unavailable. Please retry.");
}

/**
 * Google AI Studio (Gemini) via the Generative Language REST API.
 * Same message shape + error contract as the Hugging Face path so the
 * chat route can dispatch on provider without other changes.
 */
export async function chatWithGoogle(opts: {
  token: string;
  model: string;
  messages: HfMessage[];
  maxTokens: number;
  temperature: number;
}): Promise<string> {
  const system = opts.messages.find((m) => m.role === "system")?.content;
  const contents: GoogleContent[] = opts.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`,
      {
        method: "POST",
        signal: ctrl.signal,
        headers: { "x-goog-api-key": opts.token, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
          contents,
          generationConfig: { maxOutputTokens: opts.maxTokens, temperature: opts.temperature },
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw googleErrorKind(res.status, body);
    }
    const json = (await res.json()) as { candidates?: GoogleContent[] };
    const text = (json.candidates?.[0]?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) throw new AiUpstreamError("upstream", "Empty reply from the model. Please retry.");
    return text.slice(0, 2000);
  } catch (e) {
    if (e instanceof AiUpstreamError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new AiUpstreamError("cold", "Request timed out. Retry in a moment.");
    }
    throw new AiUpstreamError("upstream", "Assistant is briefly unavailable. Please retry.");
  } finally {
    clearTimeout(timer);
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
      if (res.status === 400 || res.status === 404) {
        throw new AiUpstreamError("config", "Assistant is misconfigured (unknown model). Ask an admin to pick a model from the allowlist in System settings → AI Assistant.");
      }
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
