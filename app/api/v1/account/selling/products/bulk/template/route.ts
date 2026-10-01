import { auth } from "@/auth";
import { fail } from "@/lib/api/http";
import { CSV_TEMPLATE } from "@/lib/products/bulk";

/**
 * Downloadable CSV template. Sellers otherwise have to guess column names and
 * then hit per-row validation errors telling them they guessed wrong.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return fail("UNAUTHORIZED", "Sign in required", 401);

  return new Response(CSV_TEMPLATE, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // A BOM makes Excel open the file as UTF-8 instead of mangling accents.
      "Content-Disposition": 'attachment; filename="ys-bulk-listings-template.csv"',
    },
  });
}
