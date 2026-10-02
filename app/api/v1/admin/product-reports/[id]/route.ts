import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";

const schema = z.object({ status: z.enum(["DISMISSED"]) });

/**
 * Dismiss one buyer report. Dismissing is a status change, not a delete —
 * the row stays as the record that a buyer flagged this listing and someone
 * reviewed it. Restoring the listing itself is the separate products PATCH.
 */
export const PATCH = withAdmin(
  async (req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", 'status must be "DISMISSED"', 422);

    const report = await db.productReport.findUnique({ where: { id } });
    if (!report) return fail("NOT_FOUND", "Report not found", 404);

    const updated = await db.productReport.update({ where: { id }, data: { status: "DISMISSED" } });
    await audit(actor.id, "product-report.dismiss", "ProductReport", id, { productId: report.productId });
    return ok(updated);
  },
  "products"
);
