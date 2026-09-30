import { auth } from "@/auth";
import { fail, ok } from "@/lib/api/http";
import { getAiConfig } from "@/lib/ai/config";

/** Quota-free suggested prompts. Context-aware so the drawer never starts empty. */
export async function GET(req: Request) {
  const session = await auth().catch(() => null);
  if (!session?.user) return fail("UNAUTHORIZED", "Sign in to use the shopping assistant.", 401);

  const cfg = await getAiConfig();
  if (!cfg.enabled) return fail("DISABLED", "Shopping assistant is off.", 503);

  const url = new URL(req.url);
  const productSlug = url.searchParams.get("productSlug")?.slice(0, 120);
  const q = url.searchParams.get("q")?.slice(0, 120);

  const out = productSlug
    ? [
        "Summarize the reviews for this product?",
        "How does this compare to similar items?",
        "Is this the best price right now?",
        "What should I check before buying this?",
      ]
    : q
      ? [`Best ${q} under $25?`, `Compare top ${q} picks?`, "Show me flash deals?"]
      : ["Help me find a gift under $20?", "What are today's flash deals?", "Where is my recent order?"];

  return ok({ suggestions: out });
}
