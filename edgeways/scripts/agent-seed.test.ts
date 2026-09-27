import Database from "better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { appUsers, bets, db, offers } from "@/lib/db";
import {
  agentAccounts,
  agentClerkMetadata,
  DEFAULT_AGENT_ADMIN_EMAIL,
  DEFAULT_AGENT_CUSTOMER_EMAIL,
  resetDeskFile,
  seedAgentDesk,
  seedRefusals,
  upsertAgentAppUser,
} from "./agent-seed";

const DEV_ENV = {
  CLERK_SECRET_KEY: "sk_test_abc",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_abc",
};

describe("agent accounts", () => {
  it("defaults to Clerk test-mode emails with the right roles", () => {
    const [customer, admin] = agentAccounts({});
    expect(customer).toMatchObject({
      handle: "agent-customer",
      email: DEFAULT_AGENT_CUSTOMER_EMAIL,
      role: "user",
      plan: "edge",
      billingStatus: "active",
    });
    expect(admin).toMatchObject({
      handle: "agent-admin",
      email: DEFAULT_AGENT_ADMIN_EMAIL,
      role: "admin",
    });
    expect(customer!.email).toContain("+clerk_test@");
    expect(admin!.email).toContain("+clerk_test@");
  });

  it("honours AGENT_*_EMAIL overrides", () => {
    const [customer, admin] = agentAccounts({
      AGENT_CUSTOMER_EMAIL: " Cust+clerk_test@Edgeways.test ",
      AGENT_ADMIN_EMAIL: "ops+clerk_test@edgeways.test",
    });
    expect(customer!.email).toBe("cust+clerk_test@edgeways.test");
    expect(admin!.email).toBe("ops+clerk_test@edgeways.test");
  });

  it("pre-confirms the age gate and legal consent in Clerk metadata", () => {
    expect(agentClerkMetadata(1)).toMatchObject({
      ageConfirmed: true,
      ageConfirmedAt: 1,
      legalAccepted: true,
    });
  });
});

describe("seed guard", () => {
  it("allows a dev Clerk key on local SQLite", () => {
    expect(seedRefusals(DEV_ENV)).toEqual([]);
  });

  it("refuses a missing or live Clerk secret key", () => {
    expect(seedRefusals({})).toEqual(["CLERK_SECRET_KEY is not set."]);
    expect(seedRefusals({ CLERK_SECRET_KEY: "sk_live_abc" })[0]).toMatch(/sk_test_/);
    expect(seedRefusals({ ...DEV_ENV, CLERK_SECRET_KEY: "rk_test_abc" })[0]).toMatch(/sk_test_/);
  });

  it("refuses a live publishable key", () => {
    expect(
      seedRefusals({ ...DEV_ENV, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_abc" })
    ).toHaveLength(1);
  });

  it("refuses Neon, Postgres and a DB path override", () => {
    expect(seedRefusals({ ...DEV_ENV, EDGEWAYS_DESK_BACKEND: "neon" })).toHaveLength(1);
    expect(seedRefusals({ ...DEV_ENV, DATABASE_URL: "postgres://x" })).toHaveLength(1);
    expect(seedRefusals({ ...DEV_ENV, EDGEWAYS_DB_PATH: "/tmp/x.db" })).toHaveLength(1);
  });

  it("refuses emails that are not Clerk test addresses, or shared", () => {
    expect(
      seedRefusals({ ...DEV_ENV, AGENT_CUSTOMER_EMAIL: "someone@example.com" })[0]
    ).toMatch(/agent-customer/);
    expect(
      seedRefusals({
        ...DEV_ENV,
        AGENT_CUSTOMER_EMAIL: "same+clerk_test@example.com",
        AGENT_ADMIN_EMAIL: "same+clerk_test@example.com",
      })
    ).toEqual(["agent-customer and agent-admin need different emails."]);
  });
});

describe("agent desk seed", () => {
  const now = Date.UTC(2026, 8, 27, 12);
  let summary: ReturnType<typeof seedAgentDesk>;
  let sqlite: Database.Database;

  beforeAll(() => {
    db.select().from(appUsers).all();
    sqlite = new Database(process.env.EDGEWAYS_DB_PATH!);
    resetDeskFile(sqlite);
    // Reset empties exchanges too; the app bootstrap re-adds them on a fresh open.
    sqlite
      .prepare(
        `INSERT INTO exchanges (name, commission_pct, is_default, created_at) VALUES ('Betfair', 2, 1, ?)`
      )
      .run(now);
    summary = seedAgentDesk(sqlite, { campaigns: 40, now });
  });

  it("seeds accounts, completed campaigns and a live pipeline", () => {
    expect(summary).toEqual({ accounts: 10, offers: 43, settledBets: 80, openBets: 2 });
    const rows = db.select().from(bets).all();
    expect(rows).toHaveLength(82);
    expect(rows.filter((row) => row.status === "open")).toHaveLength(2);
    expect(db.select().from(offers).all().map((row) => row.status).sort()).toEqual(
      expect.arrayContaining(["active", "completed", "planned"])
    );
  });

  it("settles every past bet with the app's own maths and keeps dates in the past", () => {
    const settled = db.select().from(bets).all().filter((row) => row.status !== "open");
    for (const row of settled) {
      expect(["won", "lost"]).toContain(row.status);
      expect(row.actualProfit).not.toBeNull();
      expect(row.settledAt!).toBeLessThan(now);
      expect(row.layStake).toBeGreaterThan(0);
    }
  });

  it("is deterministic for the same seed", () => {
    const first = db.select().from(bets).all().map((row) => [row.backOdds, row.actualProfit]);
    resetDeskFile(sqlite);
    sqlite
      .prepare(
        `INSERT INTO exchanges (name, commission_pct, is_default, created_at) VALUES ('Betfair', 2, 1, ?)`
      )
      .run(now);
    seedAgentDesk(sqlite, { campaigns: 40, now });
    const second = db.select().from(bets).all().map((row) => [row.backOdds, row.actualProfit]);
    expect(second).toEqual(first);
  });

  it("loads as a set-up desk with History rows through the app state", async () => {
    const { getAppState } = await import("@/lib/services/state");
    const { needsSetup, hasDeskActivity } = await import("@/lib/dashboard-empty");
    const state = await getAppState();
    expect(needsSetup(state)).toBe(false);
    expect(hasDeskActivity(state)).toBe(true);
    expect(state.history.length).toBeGreaterThan(0);
  });

  it("upserts the app_users row with the agent role and a paid plan", () => {
    const [customer, admin] = agentAccounts({});
    upsertAgentAppUser(sqlite, { clerkUserId: "user_agent_c", account: customer!, legalVersion: "v1", now });
    upsertAgentAppUser(sqlite, { clerkUserId: "user_agent_a", account: admin!, legalVersion: "v1", now });
    sqlite
      .prepare(`UPDATE app_users SET role = 'user', plan = 'free', billing_status = 'canceled' WHERE clerk_user_id = ?`)
      .run("user_agent_a");
    upsertAgentAppUser(sqlite, { clerkUserId: "user_agent_a", account: admin!, legalVersion: "v1", now: now + 1 });

    const rows = db.select().from(appUsers).all();
    const byId = new Map(rows.map((row) => [row.clerkUserId, row]));
    expect(byId.get("user_agent_c")).toMatchObject({ role: "user", plan: "edge", billingStatus: "active" });
    expect(byId.get("user_agent_a")).toMatchObject({
      role: "admin",
      plan: "edge",
      billingStatus: "active",
      email: DEFAULT_AGENT_ADMIN_EMAIL,
      legalVersion: "v1",
    });
  });
});

describe("worktree setup", () => {
  const setup = readFileSync(resolve(__dirname, "../../cyrus-setup.sh"), "utf8");

  it("runs the agent seed after installing dependencies", () => {
    const install = setup.indexOf("npm ci");
    const seed = setup.indexOf("npm run seed:agent");
    expect(install).toBeGreaterThan(-1);
    expect(seed).toBeGreaterThan(install);
  });
});
