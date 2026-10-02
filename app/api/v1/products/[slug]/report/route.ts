import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit } from "@/lib/api/guard";
import { isSuspended } from "@/lib/api/identity";
import { clientKey, limit } from "@/lib/api/rate-limit";
import { PRODUCT_REPORT_REASON_VALUES } from "@/lib/products/report-reasons";

const schema = z.object({
  reason: z.enum(PRODUCT_REPORT_REASON_VALUES),
  detail: z.string().trim().max(500).optional(),
});

/**
 * Flag a listing for trust & safety. Reports land in the admin products queue;
 * the reporter hears nothing back, so the response confirms receipt without
 * promising an outcome or a timeline.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);

  // Reports feed a human review queue, so a burst from one account is a
  // support-queue problem — same budget as disputes and returns.
  const rl = await limit(clientKey(req, "reports", userId), 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return fail("RATE_LIMITED", "You've filed several reports recently. Contact support.", 429, {
      retryAfterSeconds: rl.retryAfterSeconds,
    });
  }

  const { slug } = await params;
  const product = await db.product.findUnique({ where: { slug: decodeURIComponent(slug) }, select: { id: true, status: true } });
  if (!product || product.status !== "ACTIVE") return fail("NOT_FOUND", "Product not found", 404);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Pick a reason", 422);

  const report = await db.productReport.create({
    data: {
      productId: product.id,
      reporterId: userId,
      reason: parsed.data.reason,
      detail: parsed.data.detail || null,
    },
  });
  await audit(userId, "product.report", "Product", product.id, { reportId: report.id, reason: parsed.data.reason });
  return ok({ id: report.id }, undefined, 201);
}
