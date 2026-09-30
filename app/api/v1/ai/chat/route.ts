import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { getAiConfig } from "@/lib/ai/config";
import { tryAlertAction } from "@/lib/ai/actions";
import { buildAiContext, resolveMentionedProducts } from "@/lib/ai/context";
import { AiUpstreamError, chatWithHf } from "@/lib/ai/provider";
import { buildSystemPrompt, offlineFallback } from "@/lib/ai/prompt";
import { checkAiQuota } from "@/lib/ai/usage";
import { getSettingGroup } from "@/lib/server-settings";
import { log } from "@/lib/logger";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  context: z
    .object({ productSlug: z.string().max(120).optional(), searchQuery: z.string().max(120).optional() })
    .optional(),
});

/**
 * Signed-in only shopping assistant. The server owns the thread: history is
 * read from AiMessage (Alexa-style continuity across sessions) and both sides
 * are persisted, so a reload or a new device keeps the conversation.
 * JSON (non-stream) keeps free-tier usage predictable.
 */
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

  const userText = parsed.data.message;

  const [ctx, site, thread] = await Promise.all([
    buildAiContext({
      userId,
      productSlug: parsed.data.context?.productSlug,
      searchQuery: parsed.data.context?.searchQuery,
      lastUserText: userText,
    }),
    getSettingGroup("site").catch(() => ({ siteName: "ys-commerce" })),
    db.aiMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { role: true, content: true },
      take: 10,
    }),
  ]);

  // Persist the question first so a failed model call still keeps the thread.
  await db.aiMessage.create({ data: { userId, role: "USER", content: userText } }).catch((e) => {
    log.error("ai user message persist failed", { err: e });
  });

  // Agentic alert/restock requests resolve without model credits.
  const lastAssistant = thread.find((m) => m.role === "ASSISTANT")?.content ?? null;
  const action = await tryAlertAction({
    userId,
    text: userText,
    focusSlug: parsed.data.context?.productSlug,
    citations: ctx.citations,
    lastAssistantText: lastAssistant,
  }).catch((e) => {
    log.error("ai alert action failed", { err: e });
    return null;
  });
  if (action) {
    const saved = await db.aiMessage
      .create({ data: { userId, role: "ASSISTANT", content: action.reply, citations: action.citations as object } })
      .catch(() => null);
    return ok({ reply: action.reply, citations: action.citations, messageId: saved?.id ?? null });
  }

  const prior = [...thread]
    .reverse()
    .slice(-8)
    .map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: m.content }));
  const messages = [
    { role: "system" as const, content: buildSystemPrompt({ siteName: (site as { siteName: string }).siteName ?? "ys-commerce", assistantName: cfg.name }) },
    ...prior,
    { role: "user" as const, content: `CATALOG CONTEXT:\n${ctx.text || "none"}\n\nQUESTION: ${userText}` },
  ];

  try {
    const reply = await chatWithHf({ token: cfg.token, model: cfg.model, messages, maxTokens: cfg.maxTokens, temperature: cfg.temperature });
    // Every mentioned product becomes a card, even ones retrieval missed.
    const citations = await resolveMentionedProducts(reply, ctx.citations);
    const saved = await db.aiMessage
      .create({ data: { userId, role: "ASSISTANT", content: reply, citations: citations as object } })
      .catch((e) => {
        log.error("ai assistant message persist failed", { err: e });
        return null;
      });
    return ok({ reply, citations, messageId: saved?.id ?? null }, undefined, 200, { model: cfg.model });
  } catch (e) {
    if (e instanceof AiUpstreamError) {
      // Quota/cold: still return catalog facts so the drawer stays useful.
      log.warn("ai chat fallback", { kind: e.kind });
      const status = e.kind === "quota" ? 429 : 503;
      const citations = await resolveMentionedProducts(userText, ctx.citations).catch(() => ctx.citations);
      const saved = await db.aiMessage
        .create({
          data: {
            userId,
            role: "ASSISTANT",
            content: `${e.message}\n\n${offlineFallback(citations)}`,
            citations: citations as object,
          },
        })
        .catch(() => null);
      return ok(
        { reply: `${e.message}\n\n${offlineFallback(citations)}`, citations, degraded: true, messageId: saved?.id ?? null },
        undefined,
        status
      );
    }
    throw e;
  }
}
