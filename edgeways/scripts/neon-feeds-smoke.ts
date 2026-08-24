/**
 * Hosted pooled-feeds smoke test (EDGE-81 audit). Verifies the global
 * coordination primitives against the live Neon database:
 *
 *   1. feed_budget: durable counter increments atomically and is what
 *      apiUsageTodayAsync() reports back
 *   2. feed_sync_state: lease acquires, blocks an immediate second acquire
 *      (20s min interval), and releases — using a smoke key so the real
 *      "feed:live" poller lease is never touched
 *   3. events: the global Neon events table is readable (live-sync source)
 *
 * Spends exactly ONE unit of the API-Football daily budget counter (95/day)
 * to prove durability. Safe to re-run.
 *
 * Usage: npm run db:feeds-smoke
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

process.env.EDGEWAYS_DESK_BACKEND = "neon";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`, ok ? "" : { actual, expected });
}

async function main() {
  const { runWithDeskActor } = await import("../src/lib/db/desk-scope");
  const budget = await import("../src/lib/db/neon-feed-budget");
  const sync = await import("../src/lib/db/neon-feed-sync");
  const { listNeonEvents } = await import("../src/lib/db/neon-events");
  const { apiUsageTodayAsync, DAILY_BUDGET } = await import(
    "../src/lib/services/apifootball"
  );

  await runWithDeskActor(
    { clerkUserId: "user_3HqzZ0vGHKdHGozq8a064YzgQWk", email: "samhayter.design@gmail.com" },
    async () => {
      // -- 1. Durable budget counter ----------------------------------------
      const before = await budget.neonFeedBudgetUsed();
      const spent = await budget.spendNeonFeedBudget(DAILY_BUDGET);
      check("budget spend allowed", spent != null, true);
      const after = await budget.neonFeedBudgetUsed();
      check("budget counter durable (+1)", after, before + 1);
      const usage = await apiUsageTodayAsync();
      check("apiUsageTodayAsync reads Neon counter", usage.used, after);
      check("apiUsageTodayAsync budget", usage.budget, DAILY_BUDGET);

      // -- 2. Sync lease (smoke key — never touches the real poller) --------
      const KEY = "feed:smoke";
      const lease = sync.neonFeedSyncLease();
      const first = await lease.acquire(KEY);
      check("lease acquires when free", first, true);
      const second = await lease.acquire(KEY);
      check("second acquire blocked by min interval", second, false);
      const state = await sync.readNeonFeedSyncState(KEY);
      check("lease state row written", state?.key, KEY);
      check("lease lock is in the future", (state?.lockedUntil ?? 0) > Date.now(), true);
      await lease.release(KEY);
      const released = await sync.readNeonFeedSyncState(KEY);
      check("lease release clears lock", released?.lockedUntil, 0);
      const reacquire = await lease.acquire(KEY);
      check("re-acquire still throttled after release", reacquire, false);

      // -- 3. Global events table -------------------------------------------
      const events = await listNeonEvents();
      check("events readable", Array.isArray(events), true);
      console.log(`  info: ${events.length} global events on the hosted desk`);
    }
  );

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nHosted feeds smoke: all checks passed");
}

main().catch((err) => {
  console.error("Hosted feeds smoke failed:", err);
  process.exit(1);
});
