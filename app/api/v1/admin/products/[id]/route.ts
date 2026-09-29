import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";

const patchSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "TAKEDOWN"]),
  note: z.string().max(500).optional(),
});

export const GET = withAdmin(
  async (_req, _actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const product = await db.product.findUnique({
      where: { id },
      include: { store: { select: { name: true, slug: true } }, variants: true },
    });
    if (!product) return fail("NOT_FOUND", "Product not found", 404);
    return ok(product);
  }
);

export const PATCH = withAdmin(
  async (req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "status must be DRAFT, ACTIVE or TAKEDOWN", 422);

    const product = await db.product.findUnique({ where: { id } });
    if (!product) return fail("NOT_FOUND", "Product not found", 404);

    const updated = await db.product.update({ where: { id }, data: { status: parsed.data.status } });
    await audit(actor.id, `product.${parsed.data.status.toLowerCase()}`, "Product", id, { note: parsed.data.note });
    return ok(updated);
  }
);
