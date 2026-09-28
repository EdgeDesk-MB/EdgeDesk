/**
 * EDGE-214: `npm run seed:agent`. Creates (or refreshes) the agent-customer,
 * agent-admin and agent-new users on the Clerk DEVELOPMENT instance, then
 * resets and reseeds their local SQLite desks. agent-new is reset to an empty
 * set-up desk. Idempotent: every run leaves the same accounts and a fresh
 * desk dated relative to now.
 *
 * `npm run seed:agent -- --heavy` gives agent-customer about 10,000 settled
 * bets instead of 2,400, for /history performance work (EDGE-223).
 *
 * Sign in on /login with the account email, then the Clerk test code 424242.
 * Refuses to run unless CLERK_SECRET_KEY is sk_test_ and the desk is local
 * SQLite. Prints status only, never keys.
 */
import { config } from "dotenv";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createClerkClient } from "@clerk/nextjs/server";
import {
  agentAccounts,
  agentClerkMetadata,
  CLERK_TEST_VERIFICATION_CODE,
  resetDeskFile,
  seedAgentDesk,
  seedEmptyAgentDesk,
  seedRefusals,
  upsertAgentAppUser,
  type AgentAccount,
} from "./agent-seed";

config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

async function ensureClerkUser(
  clerk: ReturnType<typeof createClerkClient>,
  account: AgentAccount,
  now: number
): Promise<{ id: string; created: boolean }> {
  const metadata = agentClerkMetadata(now);
  const { data } = await clerk.users.getUserList({ emailAddress: [account.email], limit: 1 });
  const existing = data[0];
  if (existing) {
    await clerk.users.updateUser(existing.id, {
      firstName: account.firstName,
      lastName: account.lastName,
    });
    await clerk.users.updateUserMetadata(existing.id, { unsafeMetadata: metadata });
    return { id: existing.id, created: false };
  }
  const user = await clerk.users.createUser({
    emailAddress: [account.email],
    firstName: account.firstName,
    lastName: account.lastName,
    skipPasswordRequirement: true,
    skipLegalChecks: true,
    unsafeMetadata: metadata,
  });
  return { id: user.id, created: true };
}

async function main(): Promise<void> {
  const accounts = agentAccounts(process.env, { heavy: process.argv.includes("--heavy") });
  const refusals = seedRefusals(process.env, accounts);
  if (fs.existsSync(path.join(process.cwd(), "data", "demo-mode"))) {
    refusals.push("data/demo-mode is present, so the app would serve the demo desk. Turn demo mode off first.");
  }
  if (refusals.length > 0) {
    console.error("agent seed: refused");
    for (const reason of refusals) console.error(`  - ${reason}`);
    process.exit(1);
  }

  // Imported after the guard so nothing opens a database on a refused run.
  const { db, appUsers, resolveDbPath } = await import("@/lib/db");
  const { runWithDeskActor, deskFileToken } = await import("@/lib/db/desk-scope");
  const { LEGAL_EFFECTIVE_DATE } = await import("@/lib/legal/public");

  /** First app query opens the file and runs the schema bootstrap. */
  const openBootstrapped = (dbPath: string): Database.Database => {
    db.select().from(appUsers).all();
    return new Database(dbPath);
  };

  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const now = Date.now();
  const dataDir = path.join(process.cwd(), "data");
  const seeded: Array<{ account: AgentAccount; clerkUserId: string }> = [];

  for (const account of accounts) {
    const { id: clerkUserId, created } = await ensureClerkUser(clerk, account, now);
    console.log(`agent seed: ${account.handle} Clerk user ${created ? "created" : "refreshed"} (${account.email})`);

    const expectedPath = path.join(dataDir, "desks", `${deskFileToken(clerkUserId)}.db`);
    runWithDeskActor({ clerkUserId, email: account.email }, () => {
      const dbPath = resolveDbPath();
      if (dbPath !== expectedPath) {
        throw new Error(`${account.handle} resolves to ${dbPath}, not its own desk file. Refusing to reset it.`);
      }
      if (fs.existsSync(dbPath)) {
        const raw = new Database(dbPath);
        try {
          resetDeskFile(raw);
        } finally {
          raw.close();
        }
      }
      const sqlite = openBootstrapped(dbPath);
      let summary: ReturnType<typeof seedAgentDesk>;
      try {
        upsertAgentAppUser(sqlite, {
          clerkUserId,
          account,
          legalVersion: LEGAL_EFFECTIVE_DATE,
          now,
        });
        summary = sqlite.transaction(() =>
          account.desk === "empty"
            ? seedEmptyAgentDesk(sqlite, { now })
            : seedAgentDesk(sqlite, { campaigns: account.campaigns, now })
        )();
        sqlite.pragma("wal_checkpoint(TRUNCATE)");
      } finally {
        sqlite.close();
      }
      console.log(
        `agent seed: ${account.handle} desk reset (${summary.accounts} accounts, ${summary.offers} offers, ` +
          `${summary.settledBets} settled bets, ${summary.openBets} open)`
      );
    });
    seeded.push({ account, clerkUserId });
  }

  // Admin pages and /admin/users read app_users outside a desk scope, so the
  // role and the user list also live in the unsigned desk file.
  runWithDeskActor({ clerkUserId: null, email: null }, () => {
    const sqlite = openBootstrapped(resolveDbPath());
    try {
      for (const { account, clerkUserId } of seeded) {
        upsertAgentAppUser(sqlite, { clerkUserId, account, legalVersion: LEGAL_EFFECTIVE_DATE, now });
      }
      sqlite.pragma("wal_checkpoint(TRUNCATE)");
    } finally {
      sqlite.close();
    }
  });
  console.log("agent seed: admin user list refreshed");
  console.log(`agent seed: done. Sign in at /login with the email above, code ${CLERK_TEST_VERIFICATION_CODE}.`);
}

main().catch((error: unknown) => {
  console.error("agent seed: failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
