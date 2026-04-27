/**
 * Validate that a request is coming from Vercel Cron (or another trusted source
 * that knows CRON_SECRET). Vercel Cron automatically sends
 * `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is set in the project's
 * environment variables. Pattern lifted from
 * client-dashboards/src/app/api/sync/route.ts.
 *
 * Returns null if authorized; otherwise a Response describing the failure that
 * the route handler should return as-is.
 */
export function checkCronAuth(request: Request): Response | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron-auth] CRON_SECRET not set — rejecting request");
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
