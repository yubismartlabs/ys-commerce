import { fail, ok } from "@/lib/api/http";
import { loadProduct } from "@/lib/products/detail";
import { ApiError } from "@/lib/api/guard";

/** Public product detail. Shares its loader with the storefront page. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    return ok(await loadProduct(slug));
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
}
