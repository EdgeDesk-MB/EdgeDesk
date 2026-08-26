/**
 * Server boot hook. Registers the durable racing usage recorder so every
 * serverless instance counts provider calls into `feed_budget` for the admin
 * feed monitor — covers API routes, the leased feed poller, and admin tests
 * without each call site opting in.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureRacingUsageRecorder } = await import(
    "@/lib/services/racing-usage-recorder"
  );
  ensureRacingUsageRecorder();
}
