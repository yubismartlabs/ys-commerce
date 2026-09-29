import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit } from "@/lib/api/guard";
import { isSuspended } from "@/lib/api/identity";
import { productInput } from "@/lib/products/schema";

async function ownProduct(userId: string, id: string) {
  const stores = await db.store.findMany({ where: { ownerId: userId }, select: { id: true } });
  const product = await db.product.findUnique({
    where: { id },
    include: { variants: true, store: { select: { id: true, name: true } } },
  });
  if (!product || !stores.some((s) => s.id === product.storeId)) return null;
  return product;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  const { id } = await params;
  const product = await ownProduct(userId, id);
  if (!product) return fail("NOT_FOUND", "Product not found", 404);
  return ok(product);
}

const updateSchema = productInput.omit({ storeId: true }).partial().extend({
  status: z.enum(["DRAFT", "ACTIVE"]).optional(),
});

/** Edit own listing (DRAFT/ACTIVE only) with wholesale variant replace. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);
  const { id } = await params;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid product", 422);

  const product = await ownProduct(userId, id);
  if (!product) return fail("NOT_FOUND", "Product not found", 404);
  if (product.status === "TAKEDOWN") return fail("CONFLICT", "Taken-down listings can only be restored by support", 409);

  const { variants, specs, ...rest } = parsed.data;
  const updated = await db.$transaction(async (tx) => {
    if (variants) {
      await tx.productVariant.deleteMany({ where: { productId: id } });
      await tx.productVariant.createMany({
        data: variants.map((v) => ({ productId: id, ...v, sku: v.sku || null })),
      });
    }
    return tx.product.update({
      where: { id },
      data: { ...rest, ...(specs ? { specs: specs as object } : {}) },
      include: { variants: true },
    });
  });
  await audit(userId, "product.update", "Product", id, { via: "seller" });
  return ok(updated);
}

/** Delete own listing — only with zero order history. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);
  const { id } = await params;

  const product = await ownProduct(userId, id);
  if (!product) return fail("NOT_FOUND", "Product not found", 404);
  const sold = await db.orderItem.count({ where: { productId: id } });
  if (sold > 0) return fail("CONFLICT", "Listings with order history can't be deleted — set DRAFT instead", 409);

  await db.product.delete({ where: { id } });
  await audit(userId, "product.delete", "Product", id, { via: "seller" });
  return ok({ deleted: true });
}
