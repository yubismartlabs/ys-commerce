import { z } from "zod";
import { auth } from "@/auth";
import { fail, ok } from "@/lib/api/http";
import { getAiConfig } from "@/lib/ai/config";
import { buildAiContext } from "@/lib/ai/context";
import { AiUpstreamError, chatWithHf } from "@/lib/ai/provider";
import { buildSystemPrompt, offlineFallback } from "@/lib/ai/prompt";
import { checkAiQuota } from "@/lib/ai/usage";
import { getSettingGroup } from "@/lib/server-settings";
import { log } from "@/lib/logger";

const msgSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const bodySchema = z.object({
  messages: z.array(msgSchema).min(1).max(20),
  context: z
    .object({ productSlug: z.string().max(120).optional(), searchQuery: z.string().max(120).optional() })
    .optional(),
});

/** Signed-in only shopping assistant. JSON (non-stream) keeps free-tier usage predictable. */
export async function POST(req: Request) {
  const session = await auth().catch(() => null);
  const userId = session?.user ? (session.user as { id: string }).id : null;
  if (!userId) return fail("UNAUTHORIZED", "Sign in to use the shopping assistant.", 401);

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid payload", 422);

  const cfg = await getAiConfig();
  if (!cfg.enabled) return fail("DISABLED", "Shopping assistant is off.", 503);
  if (!cfg.hasToken || !cfg.token) return fail("NO_KEY", "Assistant has no Hugging Face token yet. Ask an admin to add one in System settings → AI Assistant.", 503);

  const quota = await checkAiQuota(req, userId, cfg);
  if (!quota.ok) return fail("RATE_LIMITED", quota.message, 429);

  const lastUser = [...parsed.data.messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return fail("VALIDATION", "No user message.", 422);

  const ctx = await buildAiContext({
    userId,
    productSlug: parsed.data.context?.productSlug,
    searchQuery: parsed.data.context?.searchQuery,
    lastUserText: lastUser.content,
  });

  const site = await getSettingGroup("site").catch(() => ({ siteName: "ys-commerce" }));
  const prior = parsed.data.messages.slice(0, -1).slice(-7).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const messages = [
    { role: "system" as const, content: buildSystemPrompt({ siteName: (site as { siteName: string }).siteName ?? "ys-commerce", assistantName: cfg.name }) },
    ...prior,
    { role: "user" as const, content: `CATALOG CONTEXT:\n${ctx.text || "none"}\n\nQUESTION: ${lastUser.content}` },
  ];

  try {
    const reply = await chatWithHf({ token: cfg.token, model: cfg.model, messages, maxTokens: cfg.maxTokens, temperature: cfg.temperature });
    return ok({ reply, citations: ctx.citations }, undefined, 200, { model: cfg.model });
  } catch (e) {
    if (e instanceof AiUpstreamError) {
      // Quota/cold: still return catalog facts so the drawer stays useful.
      log.warn("ai chat fallback", { kind: e.kind });
      const status = e.kind === "quota" ? 429 : 503;
      return ok(
        { reply: `${e.message}\n\n${offlineFallback(ctx.citations)}`, citations: ctx.citations, degraded: true },
        undefined,
        status
      );
    }
    throw e;
  }
}
