import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit } from "@/lib/api/guard";
import { isSuspended } from "@/lib/api/identity";
import { productInput, variantSchema } from "@/lib/products/schema";

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

/**
 * Sync submitted variants against the stored rows.
 *
 * The previous implementation was `deleteMany` + `createMany`, which minted new
 * IDs for every option on each save — breaking anything holding a variant id
 * and losing concurrent edits. Instead: match on SKU (falling back to name),
 * update what survived, insert the genuinely new, delete only what the seller
 * actually removed.
 */
async function syncVariants(
  tx: Prisma.TransactionClient,
  productId: string,
  submitted: Array<z.infer<typeof variantSchema>>,
  existing: Array<{ id: string; name: string; sku: string | null }>
) {
  const keyOf = (v: { name: string; sku?: string | null }) => (v.sku?.trim() ? `sku:${v.sku.trim()}` : `name:${v.name.trim()}`);
  const existingByKey = new Map(existing.map((v) => [keyOf(v), v]));
  const keepIds = new Set<string>();

  for (const v of submitted) {
    const key = keyOf(v);
    const prior = existingByKey.get(key);
    const data = {
      name: v.name,
      sku: v.sku?.trim() || null,
      price: v.price ?? null,
      image: v.image || null,
      stock: v.stock,
    };
    if (prior) {
      keepIds.add(prior.id);
      await tx.productVariant.update({ where: { id: prior.id }, data });
    } else {
      const created = await tx.productVariant.create({ data: { productId, ...data } });
      keepIds.add(created.id);
    }
  }

  const removed = existing.filter((v) => !keepIds.has(v.id)).map((v) => v.id);
  if (removed.length > 0) {
    await tx.productVariant.deleteMany({ where: { id: { in: removed } } });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);
  const { id } = await params;

  // Ownership + lifecycle are checked BEFORE body validation so a taken-down
  // listing reports the real reason (409) instead of failing the status enum.
  const product = await ownProduct(userId, id);
  if (!product) return fail("NOT_FOUND", "Product not found", 404);
  if (product.status === "TAKEDOWN") return fail("CONFLICT", "Taken-down listings can only be restored by support", 409);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid product", 422);

  const { variants, specs, ...rest } = parsed.data;
  const updated = await db.$transaction(async (tx) => {
    if (variants) {
      await syncVariants(tx, id, variants, product.variants);
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
