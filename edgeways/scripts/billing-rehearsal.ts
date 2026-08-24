/**
 * EDGE-7 billing rehearsal drill. Drives a throwaway test-mode customer
 * through the full subscription lifecycle via the Stripe CLI (test mode)
 * and verifies each webhook lands the right entitlement on the Neon
 * app_users row:
 *
 *   create sub (14d trial) -> trialing/edge
 *   attach pm_card_visa + trial_end=now -> active/edge
 *   downgrade to Core monthly -> active/core
 *   upgrade back to Edge monthly -> active/edge
 *   cancel -> free/canceled
 *   refund last charge -> entitlement unchanged (charge.refunded ignored)
 *
 * Requires `stripe listen --forward-to localhost:3000/api/billing/webhook`
 * running so events reach the local webhook handler, and DATABASE_URL set.
 * Cleans up after itself (deletes the Stripe customer and Neon row).
 *
 * Usage: npx tsx scripts/billing-rehearsal.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const CLERK_ID = "user_rehearsal_edge7";
const EMAIL = "edge7-rehearsal@edgeways.test";
const EDGE_MONTH = process.env.STRIPE_PRICE_EDGE_MONTH ?? "";
const CORE_MONTH = process.env.STRIPE_PRICE_CORE_MONTH ?? "";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`, ok ? "" : { actual, expected });
}

function stripe<T = Record<string, unknown>>(args: string[]): T {
  const out = execFileSync("stripe", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Destructive commands print a confirmation banner before the JSON body.
  const jsonStart = out.indexOf("{");
  const parsed = JSON.parse(jsonStart >= 0 ? out.slice(jsonStart) : out) as T & {
    error?: { message?: string };
  };
  // The CLI prints API errors as JSON but still exits 0 — detect them.
  if (parsed && typeof parsed === "object" && parsed.error) {
    throw new Error(
      `stripe ${args.slice(0, 2).join(" ")} failed: ${parsed.error.message ?? "unknown error"}`,
    );
  }
  return parsed;
}

type EntitlementRow = {
  plan: string;
  billing_status: string;
  founding: number;
  stripe_subscription_id: string | null;
  trial_ends_at: number | null;
};

async function main() {
  if (!EDGE_MONTH || !CORE_MONTH) {
    throw new Error("STRIPE_PRICE_EDGE_MONTH / STRIPE_PRICE_CORE_MONTH missing from env");
  }
  const { neon } = await import("@neondatabase/serverless");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing from env");
  const sql = neon(url);

  async function entitlement(): Promise<EntitlementRow | null> {
    const rows = (await sql`
      SELECT plan, billing_status, founding, stripe_subscription_id, trial_ends_at
      FROM app_users WHERE clerk_user_id = ${CLERK_ID}
    `) as unknown as EntitlementRow[];
    return rows[0] ?? null;
  }

  async function waitFor(
    label: string,
    want: { plan: string; status: string },
    timeoutMs = 60_000,
  ): Promise<EntitlementRow> {
    const deadline = Date.now() + timeoutMs;
    let last: EntitlementRow | null = null;
    while (Date.now() < deadline) {
      last = await entitlement();
      if (last && last.plan === want.plan && last.billing_status === want.status) {
        console.log(`PASS ${label} -> ${last.plan}/${last.billing_status}`);
        return last;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    failures += 1;
    console.log(`FAIL ${label}`, { actual: last, expected: want });
    throw new Error(`Drill aborted at: ${label}`);
  }

  let customerId = "";
  let subscriptionId = "";
  try {
    // -- 1. Sign-up equivalent: customer + 14-day Edge trial ----------------
    const customer = await stripe<{ id: string }>([
      "customers", "create",
      "--email", EMAIL,
      "--name", "EDGE-7 rehearsal (throwaway)",
      "-d", `metadata[clerkUserId]=${CLERK_ID}`,
    ]);
    customerId = customer.id;
    console.log(`customer ${customerId}`);

    const sub = await stripe<{ id: string; status: string; items: { data: { id: string }[] } }>([
      "subscriptions", "create",
      "--customer", customerId,
      "-d", `items[0][price]=${EDGE_MONTH}`,
      "-d", "trial_period_days=14",
      "-d", `metadata[clerkUserId]=${CLERK_ID}`,
    ]);
    subscriptionId = sub.id;
    check("subscription starts trialing", sub.status, "trialing");
    const itemId = sub.items.data[0]?.id ?? "";

    const trialing = await waitFor("webhook: trial lands Edge trialing", {
      plan: "edge",
      status: "trialing",
    });
    check("trial row links subscription", trialing.stripe_subscription_id, subscriptionId);
    check("trial row has trial_ends_at", trialing.trial_ends_at != null, true);

    // -- 2. Trial -> paid (card attached, trial ended early) ----------------
    // Attaching the shared test PM clones it — use the clone's id.
    const attached = await stripe<{ id: string }>([
      "payment_methods", "attach", "pm_card_visa", "--customer", customerId,
    ]);
    await stripe([
      "customers", "update", customerId,
      "-d", `invoice_settings[default_payment_method]=${attached.id}`,
    ]);
    await stripe(["subscriptions", "update", subscriptionId, "-d", "trial_end=now"]);
    await waitFor("webhook: trial converts to active Edge", {
      plan: "edge",
      status: "active",
    });

    // -- 3. Downgrade Edge -> Core ------------------------------------------
    await stripe([
      "subscriptions", "update", subscriptionId,
      "-d", `items[0][id]=${itemId}`,
      "-d", `items[0][price]=${CORE_MONTH}`,
      "-d", "proration_behavior=none",
    ]);
    await waitFor("webhook: downgrade lands Core", { plan: "core", status: "active" });

    // -- 4. Upgrade Core -> Edge --------------------------------------------
    const subNow = await stripe<{ items: { data: { id: string }[] } }>([
      "subscriptions", "retrieve", subscriptionId,
    ]);
    const itemIdNow = subNow.items.data[0]?.id ?? itemId;
    await stripe([
      "subscriptions", "update", subscriptionId,
      "-d", `items[0][id]=${itemIdNow}`,
      "-d", `items[0][price]=${EDGE_MONTH}`,
      "-d", "proration_behavior=none",
    ]);
    await waitFor("webhook: upgrade lands Edge", { plan: "edge", status: "active" });

    // -- 5. Cancel -----------------------------------------------------------
    await stripe(["subscriptions", "cancel", subscriptionId, "--confirm"]);
    const canceled = await waitFor("webhook: cancel lands Free", {
      plan: "free",
      status: "canceled",
    });
    // By design the subscription id is retained for audit; trial is cleared.
    check("cancel retains subscription link for audit", canceled.stripe_subscription_id, subscriptionId);
    check("cancel clears trial_ends_at", canceled.trial_ends_at, null);

    // -- 6. Refund (handler ignores charge.refunded; state must not change) --
    const charges = await stripe<{ data: { id: string }[] }>([
      "charges", "list", "--customer", customerId, "--limit", "1",
    ]);
    const chargeId = charges.data[0]?.id;
    if (chargeId) {
      await stripe(["refunds", "create", "--charge", chargeId]);
      await new Promise((r) => setTimeout(r, 5000));
      const after = await entitlement();
      check("refund leaves entitlement untouched", after && [after.plan, after.billing_status], [
        "free",
        "canceled",
      ]);
    } else {
      console.log("SKIP refund: no charge found");
    }
  } finally {
    // -- Cleanup --------------------------------------------------------------
    if (subscriptionId) {
      try {
        await stripe(["subscriptions", "cancel", subscriptionId, "--confirm"]);
      } catch {
        /* already canceled */
      }
    }
    if (customerId) {
      try {
        await stripe(["customers", "delete", customerId, "--confirm"]);
        console.log(`cleaned up customer ${customerId}`);
      } catch (error) {
        console.log(`WARN: could not delete customer ${customerId}`, error);
      }
    }
    await sql`DELETE FROM app_users WHERE clerk_user_id = ${CLERK_ID}`;
    console.log("cleaned up Neon rehearsal row");
  }

  if (failures > 0) {
    console.log(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nBilling rehearsal drill: all checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
