import { auth } from "@/auth";
import { fail } from "@/lib/api/http";
import { CSV_UPDATE_TEMPLATE } from "@/lib/products/bulk";

/** Template for the bulk UPDATE (price/stock feed) workflow. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return fail("UNAUTHORIZED", "Sign in required", 401);

  return new Response(CSV_UPDATE_TEMPLATE, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ys-bulk-update-template.csv"',
    },
  });
}
