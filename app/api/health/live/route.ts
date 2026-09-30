/**
 * Liveness and readiness.
 *
 * Liveness answers "is this process running" and must not touch the database:
 * if it did, a brief database outage would make an orchestrator restart every
 * healthy instance, turning a dependency blip into a full outage.
 *
 * Readiness answers "can this process serve traffic" and does check the
 * database, so a replica with a broken connection is pulled from the load
 * balancer instead of receiving requests that will fail.
 */
export const dynamic = "force-dynamic";

function uptimeSeconds() {
  return Math.round(process.uptime());
}

export async function GET() {
  return Response.json(
    { status: "ok", uptimeSeconds: uptimeSeconds(), timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
