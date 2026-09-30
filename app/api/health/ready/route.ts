import { db } from "@/lib/db";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Readiness. Checks the one dependency whose failure makes the process unable
 * to serve: the database. Returns 503 so a load balancer stops sending traffic
 * here while the connection is broken.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ready", database: "ok", latencyMs: Date.now() - startedAt },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    log.error("health: database unreachable", { err: e });
    return Response.json(
      { status: "unavailable", database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
